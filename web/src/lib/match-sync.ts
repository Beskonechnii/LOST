// Только сервер: отчёт OpenDota → строки БД. Единственное место, где постгейм приземляется в базу.
//
// Раньше здесь была своя урезанная выборка из API (kills/deaths/netWorth и всё). Теперь берём тот
// же самый MatchReport, что рисует страница матча: одна форма данных на показ и на архив — значит
// цифра в рейтинге и цифра в отчёте не разъедутся, а поход в OpenDota переиспользует общий кэш.

import type { PrismaClient } from "@/generated/prisma/client";
import { loadMatchReport } from "./match-api";
import { mvpScore, type MatchReport, type PlayerReport, type Side } from "./opendota";
import { playerAccountId } from "./profiles";

/**
 * Кто из ростера играл: account_id → id игрока. Чужие в матче просто не попадают в архив.
 *
 * Берём всех, а не только тех, у кого заполнен `accountId`: id может быть выведен из ссылки на
 * Dotabuff/Stratz/Steam (см. `playerAccountId`). Фильтр по колонке терял бы таких молча.
 */
async function accountIndex(prisma: PrismaClient) {
  const players = await prisma.player.findMany({
    select: { id: true, accountId: true, dotabuffUrl: true, stratzUrl: true, steamUrl: true },
  });
  const index = new Map<string, number>();
  for (const p of players) {
    const acc = playerAccountId(p);
    if (acc) index.set(acc, p.id);
  }
  return index;
}

/**
 * Какая сторона матча — какая команда лиги. Считаем по составу: та команда, чьих игроков
 * в пятёрке больше. Минимум двое — иначе один случайно совпавший account_id (стендин, смурф)
 * переворачивал бы всю серию. Та же логика, что распознаёт названия на странице матча.
 */
async function detectSides(
  prisma: PrismaClient,
  report: MatchReport,
  candidates: number[],
): Promise<{ radiantTeamId: number | null; direTeamId: number | null }> {
  const spots = await prisma.rosterSpot.findMany({
    where: { teamId: { in: candidates } },
    select: {
      teamId: true,
      player: { select: { accountId: true, dotabuffUrl: true, stratzUrl: true, steamUrl: true } },
    },
  });
  const teamByAccount = new Map<string, number>();
  for (const s of spots) {
    const acc = playerAccountId(s.player);
    if (acc) teamByAccount.set(acc, s.teamId);
  }

  const best = (side: Side) => {
    const tally = new Map<number, number>();
    for (const p of report.players.filter((x) => x.side === side)) {
      const t = p.accountId != null ? teamByAccount.get(String(p.accountId)) : undefined;
      if (t) tally.set(t, (tally.get(t) ?? 0) + 1);
    }
    let win: number | null = null;
    let n = 0;
    for (const [t, c] of tally) if (c > n) [win, n] = [t, c];
    return n >= 2 ? win : null;
  };

  const radiant = best("radiant");
  const dire = best("dire");
  // Одна сторона узнана, вторая нет — вторая по остатку: в серии всего две команды.
  if (radiant && !dire) return { radiantTeamId: radiant, direTeamId: candidates.find((c) => c !== radiant) ?? null };
  if (dire && !radiant) return { radiantTeamId: candidates.find((c) => c !== dire) ?? null, direTeamId: dire };
  return { radiantTeamId: radiant, direTeamId: dire };
}

const statRow = (p: PlayerReport, won: boolean) => ({
  heroSlug: p.hero.slug,
  level: p.level,
  won,
  heroDamage: p.heroDamage,
  heroHealing: p.heroHealing,
  towerDamage: p.towerDamage,
  netWorth: p.netWorth,
  gpm: p.gpm,
  xpm: p.xpm,
  kills: p.kills,
  deaths: p.deaths,
  assists: p.assists,
  campsStacked: p.campsStacked,
  obsPlaced: p.obsPlaced,
  senPlaced: p.senPlaced,
  lastHits: p.lastHits,
  denies: p.denies,
});

/**
 * Перечитать карту: стата игроков, длительность, победитель. Идемпотентно — гоняется сколько угодно
 * раз, например когда OpenDota дораспарсила реплей и в отчёте появились варды и стаки.
 *
 * Баллы НЕ начисляет: реестр `PointsEntry` меняет только человек, это осознанная граница.
 */
export async function syncMatch(prisma: PrismaClient, matchId: number) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error(`Матч ${matchId} не найден`);
  if (!match.openDotaMatchId) throw new Error(`У матча ${matchId} не проставлен openDotaMatchId`);

  const report = await loadMatchReport("opendota", match.openDotaMatchId);
  const byAccount = await accountIndex(prisma);

  const sides = await detectSides(prisma, report, [match.teamAId, match.teamBId]);
  const radiantTeamId = sides.radiantTeamId ?? match.radiantTeamId;
  const direTeamId = radiantTeamId === match.teamAId ? match.teamBId : match.teamAId;
  const winnerTeamId = radiantTeamId ? (report.radiantWin ? radiantTeamId : direTeamId) : match.winnerTeamId;

  let statsWritten = 0;
  const scored: { playerId: number; score: number }[] = [];
  for (const p of report.players) {
    const playerId = p.accountId != null ? byAccount.get(String(p.accountId)) : undefined;
    if (!playerId) continue;
    const won = p.side === "radiant" ? report.radiantWin : !report.radiantWin;
    const data = statRow(p, won);
    await prisma.matchStat.upsert({
      where: { matchId_playerId: { matchId: match.id, playerId } },
      create: { matchId: match.id, playerId, ...data },
      update: data,
    });
    statsWritten++;
    scored.push({ playerId, score: mvpScore(data) });
  }

  await prisma.match.update({
    where: { id: match.id },
    data: {
      status: "finished",
      durationSec: report.durationSeconds,
      startedAt: report.startTime ? new Date(report.startTime * 1000) : null,
      radiantScore: report.radiantScore,
      direScore: report.direScore,
      // Первый пик — за той стороной, чей ход открывает драфт. Драфта нет (Bo1 без CM) → null.
      firstPickRadiant: report.picksBans.length ? report.picksBans[0].side === "radiant" : null,
      radiantTeamId,
      winnerTeamId,
    },
  });

  // Варды карты: сносим прежние и пишем заново (как стата — производные от отчёта, идемпотентно).
  // teamId проставляем по стороне: у распарсенного матча так «карта вардов команды» берётся по teamId.
  await prisma.ward.deleteMany({ where: { matchId: match.id } });
  if (report.wards.length) {
    await prisma.ward.createMany({
      data: report.wards.map((w) => ({
        matchId: match.id,
        teamId: (w.side === "radiant" ? radiantTeamId : direTeamId) ?? null,
        side: w.side,
        type: w.type,
        heroSlug: w.hero.slug,
        x: w.x,
        y: w.y,
        placed: w.placed,
        leftAt: w.left,
        killerSlug: w.killer?.slug ?? "",
      })),
    });
  }

  return {
    matchId: match.id,
    openDotaMatchId: report.matchId,
    parsed: report.parsed,
    statsWritten,
    winnerTeamId,
    suggestedMvp: scored.sort((a, b) => b.score - a.score)[0] ?? null,
  };
}
