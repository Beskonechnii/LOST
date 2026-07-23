// Чтение данных для студии: команды, игроки, матчи под автозаполнение шаблонов.
// Пишет — только API-роуты (/api/studio/*), здесь только выборки.

import { prisma } from "@/lib/prisma";
import { rolePosition, roleOrder } from "@/lib/roles";

/**
 * MMR команды не хранится — считается по составу, как и standings. Берём только основу (позиции 1–5):
 * замены и тренер не должны двигать цифру, по которой команды сравнивают между собой.
 */
export function teamMmr(players: { role: string | null; mmr: number | null }[]) {
  const core = players.filter((p) => rolePosition(p.role) !== null && p.mmr);
  const total = core.reduce((sum, p) => sum + (p.mmr ?? 0), 0);
  return { total, average: core.length ? Math.round(total / core.length) : null, counted: core.length };
}

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
  /** Временно: сколько игроков без account_id — их подсвечиваем, пока добиваем ростер. */
  noAccountIdCount: number;
  /** Средний MMR основы (поз. 1–5); null, если MMR не проставлен ни у кого. */
  mmrAverage: number | null;
  mmrTotal: number;
};

export async function listTeams(): Promise<TeamCard[]> {
  const teams = await prisma.team.findMany({
    orderBy: [{ group: "asc" }, { name: "asc" }],
    include: { roster: { select: { role: true, player: { select: { accountId: true, mmr: true } } } } },
  });
  return teams.map(({ roster, ...t }) => {
    const mmr = teamMmr(roster.map((s) => ({ role: s.role, mmr: s.player.mmr })));
    return {
      ...t,
      playersCount: roster.length,
      noAccountIdCount: roster.filter((s) => !s.player.accountId).length,
      mmrAverage: mmr.average,
      mmrTotal: mmr.total,
    };
  });
}

/** Команда с составом: место в составе разворачивается в игрока с ролью этого места. */
export async function getTeam(id: number) {
  const team = await prisma.team.findUnique({ where: { id }, include: { roster: { include: { player: true } } } });
  if (!team) return null;
  // порядок состава задаёт список ролей (керри → хард, потом замены и тренер), не алфавит
  const players = team.roster
    .map((s) => ({ ...s.player, role: s.role, isCaptain: s.isCaptain, spotId: s.id }))
    .sort((a, b) => roleOrder(a.role) - roleOrder(b.role) || a.nickname.localeCompare(b.nickname));
  return { ...team, players };
}

/** Игрок со всеми его местами: он может стоять в нескольких командах (действующим — только в одной). */
export function getPlayer(id: number) {
  return prisma.player.findUnique({
    where: { id },
    include: { spots: { include: { team: true }, orderBy: { id: "asc" } } },
  });
}

export async function listPlayers() {
  const players = await prisma.player.findMany({
    orderBy: [{ nickname: "asc" }],
    include: { spots: { include: { team: { select: { id: true, name: true, tag: true } } } } },
  });
  // в списке показываем основное место (действующее, если оно есть), остальные — счётчиком
  return players.map((p) => {
    const spots = [...p.spots].sort((a, b) => roleOrder(a.role) - roleOrder(b.role));
    return { ...p, spots, main: spots[0] ?? null };
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
