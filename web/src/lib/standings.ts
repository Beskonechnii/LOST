import { prisma } from "@/lib/prisma";

export type StandingRow = {
  teamId: number;
  name: string;
  tag: string | null;
  played: number;
  wins: number;
  losses: number;
  points: number;
};
export type StandingGroup = { group: string; rows: StandingRow[] };

// Standings не храним — считаем: W/L из finished-матчей, очки из реестра баллов (team/placement и пр.).
export async function getStandings(): Promise<StandingGroup[]> {
  const [teams, matches, points] = await Promise.all([
    prisma.team.findMany(),
    prisma.match.findMany({ where: { status: "finished" } }),
    prisma.pointsEntry.findMany({ where: { subjectType: "team" } }),
  ]);

  const groups = new Map<string, StandingRow[]>();
  for (const t of teams) {
    const played = matches.filter((m) => m.teamAId === t.id || m.teamBId === t.id).length;
    const wins = matches.filter((m) => m.winnerTeamId === t.id).length;
    const pts = points.filter((p) => p.subjectId === t.id).reduce((s, p) => s + p.amount, 0);
    const row: StandingRow = { teamId: t.id, name: t.name, tag: t.tag, played, wins, losses: played - wins, points: pts };
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
