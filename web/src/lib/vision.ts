// Только сервер: «карта вардов команды» из архива. Варды лежат в БД (модель Ward, пишется в
// syncMatch), поэтому здесь чистые выборки без похода в OpenDota — сводно по команде и по карте.

import { prisma } from "./prisma";
import { heroBySlug, type Ward as ReportWard } from "./opendota";
import { withTeamUploads } from "./uploads";

// Строка Ward из БД → форма, которую ждёт компонент карты (hero/killer как {name,slug}).
type DbWard = {
  side: string;
  type: string;
  heroSlug: string;
  x: number;
  y: number;
  placed: number;
  leftAt: number | null;
  killerSlug: string;
};
const toWard = (w: DbWard): ReportWard => ({
  side: w.side as ReportWard["side"],
  type: w.type as ReportWard["type"],
  hero: heroBySlug(w.heroSlug),
  x: w.x,
  y: w.y,
  placed: w.placed,
  left: w.leftAt,
  killer: w.killerSlug ? heroBySlug(w.killerSlug) : null,
});

export type TeamWithWards = { slug: string; name: string; logo: string | null; maps: number; wards: number };

// Команды, у которых в архиве есть варды — для выбора на странице. Один groupBy по (команда, карта):
// строк ровно столько, сколько пар «команда × карта», отсюда и число карт, и сумма вардов.
export async function listTeamsWithWards(): Promise<TeamWithWards[]> {
  const grp = await prisma.ward.groupBy({ by: ["teamId", "matchId"], _count: { _all: true } });
  const byTeam = new Map<number, { maps: number; wards: number }>();
  for (const g of grp) {
    if (g.teamId == null) continue;
    const e = byTeam.get(g.teamId) ?? { maps: 0, wards: 0 };
    e.maps += 1;
    e.wards += g._count._all;
    byTeam.set(g.teamId, e);
  }
  const teams = await prisma.team.findMany({ where: { id: { in: [...byTeam.keys()] } } });
  const withLogos = await Promise.all(teams.map((t) => withTeamUploads(t)));
  return withLogos
    .map((t) => ({ slug: t.slug, name: t.name, logo: t.logo, maps: byTeam.get(t.id)!.maps, wards: byTeam.get(t.id)!.wards }))
    .sort((a, b) => b.maps - a.maps || a.name.localeCompare(b.name));
}

export type TeamMap = {
  matchId: number;
  openDotaMatchId: string | null;
  opponent: string;
  side: "radiant" | "dire" | null; // на какой стороне играла выбранная команда
  won: boolean | null;
  date: string | null;
  seriesSlug: string | null;
  obs: number;
  sen: number;
};
export type TeamVision = {
  team: { slug: string; name: string };
  wards: ReportWard[]; // все варды команды (сводно, для наложения)
  maps: TeamMap[];
};

// Сводная карта команды + список её карт из архива.
export async function teamVision(slug: string): Promise<TeamVision | null> {
  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) return null;

  const rows = await prisma.ward.findMany({ where: { teamId: team.id }, orderBy: { placed: "asc" } });
  const matchIds = [...new Set(rows.map((r) => r.matchId))];
  const matches = await prisma.match.findMany({
    where: { id: { in: matchIds } },
    include: { teamA: true, teamB: true, radiantTeam: true, series: { select: { slug: true } } },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
  });

  // Счётчики вардов команды по каждой карте.
  const cnt = new Map<number, { obs: number; sen: number }>();
  for (const w of rows) {
    const e = cnt.get(w.matchId) ?? { obs: 0, sen: 0 };
    if (w.type === "obs") e.obs += 1;
    else e.sen += 1;
    cnt.set(w.matchId, e);
  }

  const maps: TeamMap[] = matches.map((m) => {
    const side: "radiant" | "dire" | null = m.radiantTeamId == null ? null : m.radiantTeamId === team.id ? "radiant" : "dire";
    const opponent = m.teamAId === team.id ? m.teamB.name : m.teamA.name;
    const c = cnt.get(m.id) ?? { obs: 0, sen: 0 };
    return {
      matchId: m.id,
      openDotaMatchId: m.openDotaMatchId,
      opponent,
      side,
      won: m.winnerTeamId == null ? null : m.winnerTeamId === team.id,
      date: m.startedAt ? m.startedAt.toISOString() : null,
      seriesSlug: m.series?.slug ?? null,
      obs: c.obs,
      sen: c.sen,
    };
  });

  return { team: { slug: team.slug, name: team.name }, wards: rows.map(toWard), maps };
}

export type MapVision = {
  matchId: number;
  openDotaMatchId: string | null;
  durationSeconds: number;
  radiantName: string;
  direName: string;
  wards: ReportWard[]; // обе стороны
};

// Вижн одной карты (обе команды) — для режима с полоской времени.
export async function mapVision(matchId: number): Promise<MapVision | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { teamA: true, teamB: true, radiantTeam: true },
  });
  if (!match) return null;
  const rows = await prisma.ward.findMany({ where: { matchId }, orderBy: { placed: "asc" } });

  const radiantName = match.radiantTeam?.name ?? "Свет";
  const direName =
    match.radiantTeamId == null ? "Тьма" : match.radiantTeamId === match.teamAId ? match.teamB.name : match.teamA.name;

  return {
    matchId: match.id,
    openDotaMatchId: match.openDotaMatchId,
    durationSeconds: match.durationSec ?? 0,
    radiantName,
    direName,
    wards: rows.map(toWard),
  };
}
