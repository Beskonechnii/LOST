import type { PrismaClient } from "@/generated/prisma/client";
import { fetchOpenDotaMatch, mvpScore } from "./opendota";

// SYNC: по нашему matchId тянем стату из OpenDota, пишем MatchStat,
// авто-определяем победителя, отдаём подсказку MVP. Баллы НЕ начисляем — это делает админ.
export async function syncMatch(prisma: PrismaClient, matchId: number) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error(`match ${matchId} not found`);
  if (!match.openDotaMatchId) throw new Error(`match ${matchId} has no openDotaMatchId`);

  const od = await fetchOpenDotaMatch(match.openDotaMatchId);

  const players = await prisma.player.findMany({ where: { accountId: { not: null } } });
  const byAccount = new Map(players.map((p) => [p.accountId!, p.id]));

  let statsWritten = 0;
  const scored: { playerId: number; score: number }[] = [];
  for (const p of od.players) {
    const playerId = byAccount.get(String(p.accountId));
    if (!playerId) continue;
    const data = {
      heroDamage: p.heroDamage,
      netWorth: p.netWorth,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      campsStacked: p.campsStacked,
      lastHits: p.lastHits,
    };
    await prisma.matchStat.upsert({
      where: { matchId_playerId: { matchId: match.id, playerId } },
      create: { matchId: match.id, playerId, ...data },
      update: data,
    });
    statsWritten++;
    scored.push({ playerId, score: mvpScore(p) });
  }

  // Победитель из radiant_win (нужен radiantTeamId).
  let winnerTeamId = match.winnerTeamId;
  if (match.radiantTeamId) {
    const direTeamId = match.radiantTeamId === match.teamAId ? match.teamBId : match.teamAId;
    winnerTeamId = od.radiantWin ? match.radiantTeamId : direTeamId;
    await prisma.match.update({ where: { id: match.id }, data: { status: "finished", winnerTeamId } });
  }

  const suggestedMvp = scored.sort((a, b) => b.score - a.score)[0] ?? null;
  return { matchId: match.id, openDotaMatchId: od.matchId, statsWritten, winnerTeamId, suggestedMvp };
}
