// Только сервер: сборка скорборда карты для пост-гейм шаблона студии.
// Источник статы и предметов — тот же отчёт, что рисует страница /match (loadMatchReport,
// с кэшем и лимитом), а лого/цвета/названия команд подставляются из ростера по radiantTeamId.
// Форма результата — ScoreBoard (src/studio/types.ts): её же ждёт клиентский рендер шаблона.

import { prisma } from "@/lib/prisma";
import { loadMatchReport } from "@/lib/match-api";
import { withTeamUploads } from "@/lib/uploads";
import type { PlayerReport, Side } from "@/lib/opendota";
import type { BoardItem, BoardPlayer, BoardTeam, ScoreBoard } from "@/studio/types";

const item = (e: { slug: string; name: string } | null): BoardItem | null =>
  e && e.slug ? { slug: e.slug, name: e.name } : null;

const items = (arr: { slug: string; name: string }[]): BoardItem[] =>
  arr.filter((e) => e.slug).map((e) => ({ slug: e.slug, name: e.name }));

const playerRow = (p: PlayerReport): BoardPlayer => ({
  pos: p.pos,
  role: p.role,
  heroSlug: p.hero.slug,
  heroName: p.hero.name,
  nick: p.name,
  level: p.level,
  kills: p.kills,
  deaths: p.deaths,
  assists: p.assists,
  heroDamage: p.heroDamage,
  netWorth: p.netWorth,
  items: items(p.items).slice(0, 6),
  backpack: items(p.backpack).slice(0, 3),
  neutral: item(p.neutral),
});

/** Скорборд карты по её id в нашей БД. null — если карта не привязана к матчу OpenDota. */
export async function buildScoreboard(matchId: number): Promise<ScoreBoard | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { teamA: true, teamB: true },
  });
  if (!match?.openDotaMatchId) return null;

  const report = await loadMatchReport("opendota", match.openDotaMatchId);

  // Radiant — верхний блок, Dire — нижний (конвенция Dota). Ростерную команду для стороны
  // определяем по radiantTeamId (проставляется при привязке карты); нет — берём подписи отчёта.
  const radiantRoster =
    match.radiantTeamId === match.teamAId ? match.teamA : match.radiantTeamId === match.teamBId ? match.teamB : null;
  const direRoster = radiantRoster ? (radiantRoster.id === match.teamA.id ? match.teamB : match.teamA) : null;

  const [radiantImg, direImg] = await Promise.all([
    radiantRoster ? withTeamUploads(radiantRoster) : Promise.resolve(null),
    direRoster ? withTeamUploads(direRoster) : Promise.resolve(null),
  ]);

  const side = (s: Side, roster: typeof radiantImg, fallbackName: string | null, fallbackTag: string | null): BoardTeam => ({
    name: roster?.name ?? fallbackName ?? (s === "radiant" ? "Radiant" : "Dire"),
    tag: roster?.tag ?? fallbackTag,
    logo: roster?.logo ?? null,
    color: roster?.color ?? null,
    won: s === "radiant" ? report.radiantWin : !report.radiantWin,
    players: report.players
      .filter((p) => p.side === s)
      .sort((a, b) => a.pos - b.pos)
      .map(playerRow),
  });

  return {
    teamTop: side("radiant", radiantImg, report.radiantTeam, report.radiantTag),
    teamBottom: side("dire", direImg, report.direTeam, report.direTag),
  };
}
