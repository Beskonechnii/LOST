import { prisma } from "@/lib/prisma";
import { seriesPoints } from "@/lib/group-stage";

export type StandingRow = {
  teamId: number;
  name: string;
  tag: string | null;
  played: number;
  wins: number;
  losses: number;
  points: number;
  /** Из какой группы команда пришла на этап — чтобы в общей таблице было видно происхождение. */
  stageGroup: string | null;
};
export type StandingGroup = { group: string; rows: StandingRow[] };

/**
 * Standings не храним — считаем. Три слагаемых:
 *  • групповая стадия (`GroupSeries`) — очки по формуле Bo3, поэтому правка встречи в сетке
 *    сразу двигает таблицу лиги: это и есть синхронизация, отдельного копирования данных нет;
 *  • сыгранные матчи (`Match`) — плей-офф и всё, что вне групп;
 *  • реестр баллов (`PointsEntry`) — ручные начисления за места, касты и прочее.
 */
export async function getStandings(): Promise<StandingGroup[]> {
  const [teams, series, matches, points] = await Promise.all([
    prisma.team.findMany(),
    prisma.groupSeries.findMany(),
    prisma.match.findMany({ where: { status: "finished" } }),
    prisma.pointsEntry.findMany({ where: { subjectType: "team" } }),
  ]);

  const groups = new Map<string, StandingRow[]>();
  for (const t of teams) {
    const mine = series.filter((s) => s.homeId === t.id || s.awayId === t.id);
    let played = mine.length;
    let wins = 0;
    let pts = 0;
    for (const s of mine) {
      const home = s.homeId === t.id;
      const own = home ? s.homeScore : s.awayScore;
      const opp = home ? s.awayScore : s.homeScore;
      if (own > opp) wins++;
      pts += seriesPoints(own, opp);
    }

    const played2 = matches.filter((m) => m.teamAId === t.id || m.teamBId === t.id);
    played += played2.length;
    wins += played2.filter((m) => m.winnerTeamId === t.id).length;
    pts += points.filter((p) => p.subjectId === t.id).reduce((s, p) => s + p.amount, 0);

    const row: StandingRow = {
      teamId: t.id,
      name: t.name,
      tag: t.tag,
      played,
      wins,
      losses: played - wins,
      points: pts,
      stageGroup: mine.length ? (mine[0].group ?? null) : null,
    };
    const g = t.group ?? "—";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(row);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, rows]) => ({
      group,
      rows: rows.sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name)),
    }));
}
