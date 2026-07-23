// Чтение данных для студии: команды, игроки, матчи под автозаполнение шаблонов.
// Пишет — только API-роуты (/api/studio/*), здесь только выборки.

import { prisma } from "@/lib/prisma";
import { rolePosition, roleOrder } from "@/lib/roles";
import { withPlayerUploads, withTeamUploads } from "@/lib/uploads";

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
  return Promise.all(
    teams.map(async ({ roster, ...t }) => {
      const mmr = teamMmr(roster.map((s) => ({ role: s.role, mmr: s.player.mmr })));
      return {
        ...(await withTeamUploads(t)),
        playersCount: roster.length,
        noAccountIdCount: roster.filter((s) => !s.player.accountId).length,
        mmrAverage: mmr.average,
        mmrTotal: mmr.total,
      };
    }),
  );
}

export type RosterMember = {
  id: number;
  nickname: string;
  photo: string | null;
  mmr: number | null;
  role: string | null;
  position: number | null;
  isCaptain: boolean;
  country: string | null;
  accountId: string | null;
};

export type TeamWithRoster = TeamCard & { players: RosterMember[] };

type SpotWithPlayer = { role: string | null; isCaptain: boolean; player: PlayerRecord };
type PlayerRecord = { id: number; slug: string; nickname: string; photo: string | null; mmr: number | null; country: string | null; accountId: string | null };

/** Место в составе → строка ростера. Один вид данных для списка команд и для страницы команды. */
async function toRosterMember(spot: SpotWithPlayer): Promise<RosterMember> {
  const player = await withPlayerUploads(spot.player);
  return {
    id: player.id,
    nickname: player.nickname,
    photo: player.photo,
    mmr: player.mmr,
    role: spot.role,
    position: rolePosition(spot.role),
    isCaptain: spot.isCaptain,
    country: player.country,
    accountId: player.accountId,
  };
}

/** Состав в привычном порядке: керри → хард, потом замены и тренер, внутри роли — по алфавиту. */
const byRole = (a: SpotWithPlayer, b: SpotWithPlayer) =>
  roleOrder(a.role) - roleOrder(b.role) || a.player.nickname.localeCompare(b.player.nickname);

async function withRoster<T extends { slug: string; logo: string | null; wordmark?: string | null; photo?: string | null }>(
  team: T,
  roster: SpotWithPlayer[],
): Promise<T & { players: RosterMember[]; playersCount: number; noAccountIdCount: number; mmrAverage: number | null; mmrTotal: number }> {
  const mmr = teamMmr(roster.map((s) => ({ role: s.role, mmr: s.player.mmr })));
  return {
    ...(await withTeamUploads(team)),
    players: await Promise.all([...roster].sort(byRole).map(toRosterMember)),
    playersCount: roster.length,
    noAccountIdCount: roster.filter((s) => !s.player.accountId).length,
    mmrAverage: mmr.average,
    mmrTotal: mmr.total,
  };
}

/**
 * Список команд вместе с составами — для карточек на /roster/teams, которые разворачиваются
 * прямо в списке. Отдельно от listTeams(): там состав не нужен, а тут без него нечего показывать.
 */
export async function listTeamRosters(): Promise<TeamWithRoster[]> {
  const teams = await prisma.team.findMany({
    orderBy: [{ group: "asc" }, { name: "asc" }],
    include: { roster: { include: { player: true } } },
  });
  return Promise.all(teams.map(({ roster, ...t }) => withRoster(t, roster)));
}

/** Всё для страницы команды: картинки, состав и агрегаты по MMR. */
export async function getTeamProfile(id: number) {
  const team = await prisma.team.findUnique({ where: { id }, include: { roster: { include: { player: true } } } });
  if (!team) return null;
  const { roster, ...rest } = team;
  return withRoster(rest, roster);
}

/** Команда с составом: место в составе разворачивается в игрока с ролью этого места. */
export async function getTeam(id: number) {
  const team = await prisma.team.findUnique({ where: { id }, include: { roster: { include: { player: true } } } });
  if (!team) return null;
  // порядок состава задаёт список ролей (керри → хард, потом замены и тренер), не алфавит
  const players = await Promise.all(
    team.roster
      .map((s) => ({ ...s.player, role: s.role, isCaptain: s.isCaptain, spotId: s.id }))
      .sort((a, b) => roleOrder(a.role) - roleOrder(b.role) || a.nickname.localeCompare(b.nickname))
      .map(withPlayerUploads),
  );
  // Картинки самой команды оставляем как в БД: страница отдаёт их в редактор, а он должен
  // показывать реальное состояние поля, а не файл, подставленный по слагу.
  return { ...team, players };
}

/** Игрок со всеми его местами: он может стоять в нескольких командах (действующим — только в одной). */
export function getPlayer(id: number) {
  return prisma.player.findUnique({
    where: { id },
    include: { spots: { include: { team: true }, orderBy: { id: "asc" } } },
  });
}

/**
 * Всё для страницы профиля: человек, его места в составах — с лого команды и сокомандниками.
 * Отдельно от getPlayer(), потому что редактору эта развесистая выборка не нужна.
 */
export async function getPlayerProfile(id: number) {
  const player = await prisma.player.findUnique({
    where: { id },
    include: {
      spots: {
        include: { team: { include: { roster: { include: { player: true } } } } },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!player) return null;

  // порядок мест — как везде: сначала действующая команда (по порядку ролей), потом замены и тренерство
  const spots = await Promise.all(
    [...player.spots]
      .sort((a, b) => roleOrder(a.role) - roleOrder(b.role))
      .map(async ({ team, ...spot }) => ({
        ...spot,
        team: await withTeamUploads(team),
        teammates: await Promise.all(
          team.roster
            .filter((m) => m.playerId !== id)
            .sort((a, b) => roleOrder(a.role) - roleOrder(b.role) || a.player.nickname.localeCompare(b.player.nickname))
            .map(async (m) => ({ ...(await withPlayerUploads(m.player)), role: m.role, isCaptain: m.isCaptain })),
        ),
      })),
  );

  return { ...(await withPlayerUploads(player)), spots };
}

export async function listPlayers() {
  const players = await prisma.player.findMany({
    orderBy: [{ nickname: "asc" }],
    // slug и color нужны аватаркам-заглушкам: цвет команды выводится из слага (teamAccent)
    include: { spots: { include: { team: { select: { id: true, slug: true, name: true, tag: true, color: true } } } } },
  });
  // в списке показываем основное место (действующее, если оно есть), остальные — счётчиком
  return Promise.all(
    players.map(async (p) => {
      const spots = [...p.spots].sort((a, b) => roleOrder(a.role) - roleOrder(b.role));
      return { ...(await withPlayerUploads(p)), spots, main: spots[0] ?? null };
    }),
  );
}

/** Матчи для автозаполнения шаблонов: ближайшие сверху, с командами и победителем. */
export function listMatches() {
  return prisma.match.findMany({
    orderBy: [{ scheduledAt: "desc" }, { id: "desc" }],
    take: 50,
    include: { teamA: true, teamB: true, winner: true },
  });
}
