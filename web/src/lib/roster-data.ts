// Чтение данных для студии: команды, игроки, матчи под автозаполнение шаблонов.
// Пишет — только API-роуты (/api/studio/*), здесь только выборки.

import { prisma } from "@/lib/prisma";
import { roleOrder } from "@/lib/roles";

export type TeamCard = {
  id: number;
  slug: string;
  name: string;
  tag: string | null;
  group: string | null;
  color: string | null;
  logo: string | null;
  wordmark: string | null;
  photo: string | null;
  playersCount: number;
};

export async function listTeams(): Promise<TeamCard[]> {
  const teams = await prisma.team.findMany({
    orderBy: [{ group: "asc" }, { name: "asc" }],
    include: { _count: { select: { players: true } } },
  });
  return teams.map(({ _count, ...t }) => ({ ...t, playersCount: _count.players }));
}

export async function getTeam(id: number) {
  const team = await prisma.team.findUnique({ where: { id }, include: { players: true } });
  if (!team) return null;
  // порядок состава задаёт список ролей (керри → хард, потом замены и тренер), не алфавит
  const players = [...team.players].sort(
    (a, b) => roleOrder(a.role) - roleOrder(b.role) || a.nickname.localeCompare(b.nickname),
  );
  return { ...team, players };
}

export function getPlayer(id: number) {
  return prisma.player.findUnique({ where: { id }, include: { team: true } });
}

export function listPlayers() {
  return prisma.player.findMany({
    orderBy: [{ nickname: "asc" }],
    include: { team: { select: { id: true, name: true, tag: true } } },
  });
}

/** Матчи для автозаполнения шаблонов: ближайшие сверху, с командами и победителем. */
export function listMatches() {
  return prisma.match.findMany({
    orderBy: [{ scheduledAt: "desc" }, { id: "desc" }],
    take: 50,
    include: { teamA: true, teamB: true, winner: true },
  });
}
