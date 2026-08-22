// Только сервер: турниры, дивизионы и участие команд. Одно место правды для «какой турнир текущий»,
// «какие у него дивизионы» и «в каком дивизионе команда» — разбор решений в ../../TOURNAMENTS-PLAN.md.
//
// Про зеркала. Имя дивизиона продолжает лежать строкой в `Team.group`, `Series.division` и
// `GroupEntry.division`: по этим строкам фильтруют полтора десятка выборок (standings, leaders,
// архив серий, витрины ростера), и переписывать их все разом ради одного FK — способ уронить
// работающий сезон. Поэтому строки остались denormalized-зеркалом, а единственный, кто их пишет —
// этот модуль. Правило простое: дивизион команде меняют через `setTeamDivision`, а не UPDATE'ом
// поля `group` где придётся.

// Директивы `server-only` здесь намеренно нет (в отличие от account.ts): модуль зовут и разовые
// скрипты через tsx, а `server-only` в обычном node падает. Клиенту он и так не нужен — списком
// дивизионов клиентские компоненты кормятся пропом (src/lib/divisions.ts).
import { cache } from "react";
import { prisma } from "./prisma";
import { slugify } from "./profiles";
import type { Division } from "./divisions";

/** Дивизион в форме, которую ждут навигация и справочник (src/lib/divisions.ts). */
type DivisionRow = {
  id: number;
  slug: string;
  name: string;
  label: string | null;
  short: string | null;
  orderNo: number;
  relegation: boolean;
};

const toDivision = (d: DivisionRow): Division => ({
  id: d.id,
  slug: d.slug,
  name: d.name,
  label: d.label ?? d.name,
  short: d.short ?? d.slug.toUpperCase(),
  relegation: d.relegation,
});

/**
 * Текущий турнир: идущий (`running`), иначе — последний заведённый. Пока сезон один, это он;
 * когда появится второй, «текущим» станет тот, что организатор перевёл в running — не дата, а
 * явное решение оператора, иначе турнир с незаполненными датами исчез бы из витрин.
 *
 * `cache` — на один запрос: витрину рисуют несколько server-компонентов сразу, и каждый спрашивает
 * дивизионы.
 */
export const loadCurrentTournament = async () => {
  const running = await prisma.tournament.findFirst({
    where: { status: "running" },
    orderBy: { startAt: "desc" },
  });
  if (running) return running;
  return prisma.tournament.findFirst({ orderBy: [{ startAt: "desc" }, { id: "desc" }] });
};

export const currentTournament = cache(loadCurrentTournament);

/** Дивизионы турнира (по умолчанию текущего) в порядке вкладок. Пусто — база ещё не засеяна. */
export const listDivisions = async (tournamentId?: number): Promise<Division[]> => {
  const id = tournamentId ?? (await loadCurrentTournament())?.id;
  if (!id) return [];
  const rows = await prisma.division.findMany({
    where: { tournamentId: id },
    orderBy: [{ orderNo: "asc" }, { id: "asc" }],
  });
  return rows.map(toDivision);
};

/** То же, но с памятью на один запрос — витрину рисуют несколько server-компонентов сразу. */
export const getDivisions = cache(listDivisions);

/** Дивизион текущего турнира по слагу из URL — null, если такого нет (роут отдаёт notFound). */
export async function divisionBySlug(slug: string): Promise<Division | null> {
  const list = await getDivisions();
  return list.find((d) => d.slug === slug) ?? null;
}

/** Дивизион по имени (строка-зеркало из Team.group / Series.division). */
export async function divisionByName(name: string | null | undefined): Promise<Division | null> {
  if (!name) return null;
  const list = await getDivisions();
  return list.find((d) => d.name === name) ?? null;
}

/** Дивизион по id вместе с его турниром — по нему страницы разделов знают, чей это раздел. */
export const divisionWithTournament = (id: number) =>
  prisma.division.findUnique({ where: { id }, include: { tournament: true } });

/** Дивизион турнира по паре слагов из URL: /tournaments/<турнир>/<дивизион>. */
export async function divisionOfTournament(tournamentSlug: string, divisionSlug: string) {
  const row = await prisma.division.findFirst({
    where: { slug: divisionSlug, tournament: { slug: tournamentSlug } },
    include: { tournament: true },
  });
  return row;
}

/**
 * Дивизион команды в текущем турнире (с самим турниром) — по нему витрина команды знает, в какую
 * таблицу и в какой раздел вести. Команда вне текущего турнира → null.
 */
export async function teamDivision(teamId: number) {
  const current = await currentTournament();
  if (!current) return null;
  const entry = await prisma.tournamentEntry.findFirst({
    where: { teamId, division: { tournamentId: current.id } },
    include: { division: { include: { tournament: true } } },
  });
  return entry?.division ?? null;
}

// ── турниры ──────────────────────────────────────────────────────────────────

export const listTournaments = () =>
  prisma.tournament.findMany({
    orderBy: [{ startAt: "desc" }, { id: "desc" }],
    include: { divisions: { orderBy: [{ orderNo: "asc" }, { id: "asc" }] } },
  });

export const tournamentBySlug = (slug: string) =>
  prisma.tournament.findUnique({
    where: { slug },
    include: { divisions: { orderBy: [{ orderNo: "asc" }, { id: "asc" }] } },
  });

export type TournamentInput = {
  name: string;
  slug?: string | null;
  short?: string | null;
  description?: string | null;
  format?: string | null;
  prize?: string | null;
  status?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  regOpenAt?: string | null;
  regCloseAt?: string | null;
};

const TOURNAMENT_STATUSES = ["draft", "registration", "running", "finished"] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];
export const isTournamentStatus = (v: string): v is TournamentStatus =>
  (TOURNAMENT_STATUSES as readonly string[]).includes(v);

export const TOURNAMENT_STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: "Черновик",
  registration: "Приём заявок",
  running: "Идёт",
  finished: "Сыгран",
};

/** Пустая строка и null — одно и то же: «поля нет». undefined оставляет значение как было. */
const clean = (v: string | null | undefined) => {
  if (v === undefined) return undefined;
  const s = (v ?? "").trim();
  return s === "" ? null : s;
};

/** Дата из формы (`YYYY-MM-DD` или ISO). Мусор трактуем как «не задано», а не как 1970 год. */
const date = (v: string | null | undefined) => {
  if (v === undefined) return undefined;
  const s = (v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

function tournamentData(input: TournamentInput) {
  const status = clean(input.status);
  return {
    name: input.name.trim(),
    short: clean(input.short),
    description: clean(input.description),
    format: clean(input.format),
    prize: clean(input.prize),
    ...(status && isTournamentStatus(status) ? { status } : {}),
    startAt: date(input.startAt),
    endAt: date(input.endAt),
    regOpenAt: date(input.regOpenAt),
    regCloseAt: date(input.regCloseAt),
  };
}

export async function createTournament(input: TournamentInput) {
  const name = input.name.trim();
  if (!name) throw new Error("У турнира должно быть название");
  const slug = (clean(input.slug) ?? slugify(name)) || `t-${Date.now()}`;
  if (await prisma.tournament.findUnique({ where: { slug } }))
    throw new Error(`Турнир со слагом «${slug}» уже есть`);
  return prisma.tournament.create({ data: { ...tournamentData(input), slug } });
}

export async function updateTournament(id: number, input: TournamentInput) {
  if (!input.name.trim()) throw new Error("У турнира должно быть название");
  return prisma.tournament.update({ where: { id }, data: tournamentData(input) });
}

/**
 * Смена статуса отдельной операцией: это единственное поле, которое меняют «на ходу» (открыли
 * заявки, стартовали, закрыли сезон), и тащить ради него всю форму турнира незачем.
 */
export async function setTournamentStatus(id: number, status: string) {
  if (!isTournamentStatus(status)) throw new Error(`Неизвестный статус: ${status}`);
  return prisma.tournament.update({ where: { id }, data: { status } });
}

/**
 * Открыт ли приём заявок: статус «Приём заявок» и срок не прошёл. Одно место правды — правило
 * нужно и странице заявки (показывать ли форму), и записи (`submitTeamApplication`), а два
 * одинаковых условия в разных файлах однажды разъедутся.
 */
export const registrationOpen = (t: { status: string; regCloseAt: Date | null }): boolean =>
  t.status === "registration" && (!t.regCloseAt || t.regCloseAt.getTime() > Date.now());

// ── дивизионы ────────────────────────────────────────────────────────────────

export type DivisionInput = {
  name: string;
  slug?: string | null;
  label?: string | null;
  short?: string | null;
  orderNo?: number | null;
  mmrFrom?: number | null;
  mmrTo?: number | null;
};

export async function createDivision(tournamentId: number, input: DivisionInput) {
  const name = input.name.trim();
  if (!name) throw new Error("У дивизиона должно быть название");
  const slug = (clean(input.slug) ?? slugify(name)) || "div";
  const taken = await prisma.division.findFirst({ where: { tournamentId, OR: [{ slug }, { name }] } });
  if (taken) throw new Error(`В этом турнире уже есть дивизион «${taken.slug}» / «${taken.name}»`);
  const last = await prisma.division.findFirst({ where: { tournamentId }, orderBy: { orderNo: "desc" } });
  return prisma.division.create({
    data: {
      tournamentId,
      slug,
      name,
      label: clean(input.label),
      short: clean(input.short),
      orderNo: input.orderNo ?? (last ? last.orderNo + 1 : 0),
      mmrFrom: input.mmrFrom ?? null,
      mmrTo: input.mmrTo ?? null,
    },
  });
}

/**
 * Правка дивизиона. Переименование тянет за собой зеркала: имя дивизиона лежит строкой в командах,
 * сериях и итогах группы, и без этого шага таблица сезона просто опустела бы.
 */
export async function updateDivision(id: number, input: DivisionInput) {
  const name = input.name.trim();
  if (!name) throw new Error("У дивизиона должно быть название");
  const before = await prisma.division.findUnique({ where: { id } });
  if (!before) throw new Error("Дивизион не найден");

  const division = await prisma.division.update({
    where: { id },
    data: {
      name,
      slug: clean(input.slug) ?? before.slug,
      label: clean(input.label),
      short: clean(input.short),
      ...(input.orderNo === undefined || input.orderNo === null ? {} : { orderNo: input.orderNo }),
      mmrFrom: input.mmrFrom ?? null,
      mmrTo: input.mmrTo ?? null,
    },
  });

  if (before.name !== name) {
    await prisma.$transaction([
      prisma.team.updateMany({ where: { group: before.name }, data: { group: name } }),
      prisma.series.updateMany({ where: { divisionId: id }, data: { division: name } }),
      prisma.groupEntry.updateMany({ where: { divisionId: id }, data: { division: name } }),
    ]);
  }
  return division;
}

/** Удаление дивизиона — только пустого: с ним уедут участники, а вместе с ними и разрез архива. */
export async function deleteDivision(id: number) {
  const entries = await prisma.tournamentEntry.count({ where: { divisionId: id } });
  if (entries) throw new Error(`В дивизионе ${entries} команд(ы) — сначала уберите их`);
  const series = await prisma.series.count({ where: { divisionId: id } });
  if (series) throw new Error(`К дивизиону привязано ${series} встреч(и) — удалять нельзя`);
  return prisma.division.delete({ where: { id } });
}

// ── участие команд ───────────────────────────────────────────────────────────

export const divisionTeams = (divisionId: number) =>
  prisma.tournamentEntry.findMany({
    where: { divisionId },
    include: { team: true },
    orderBy: [{ seed: "asc" }, { id: "asc" }],
  });

/**
 * Поставить команду в дивизион (или снять, `divisionId = null`). Здесь же обновляется зеркало
 * `Team.group` — ради него всё и заведено одной функцией: два места, пишущих дивизион команды,
 * рано или поздно разъедутся, и витрина покажет команду не в том разделе, где её встречи.
 *
 * Участие в других турнирах не трогаем: команда играет в S2 и в S3, это разные строки.
 */
export async function setTeamDivision(
  teamId: number,
  divisionId: number | null,
  opts: { seed?: number | null; group?: string | null } = {},
) {
  if (divisionId === null) {
    const current = await currentTournament();
    if (current)
      await prisma.tournamentEntry.deleteMany({
        where: { teamId, division: { tournamentId: current.id } },
      });
    await prisma.team.update({ where: { id: teamId }, data: { group: null } });
    return null;
  }

  const division = await prisma.division.findUnique({ where: { id: divisionId } });
  if (!division) throw new Error("Дивизион не найден");

  // Одна команда — один дивизион внутри турнира: иначе она попадёт в две таблицы сразу.
  await prisma.tournamentEntry.deleteMany({
    where: { teamId, divisionId: { not: divisionId }, division: { tournamentId: division.tournamentId } },
  });
  const entry = await prisma.tournamentEntry.upsert({
    where: { divisionId_teamId: { divisionId, teamId } },
    create: { divisionId, teamId, seed: opts.seed ?? null, group: opts.group ?? null },
    update: {
      ...(opts.seed === undefined ? {} : { seed: opts.seed }),
      ...(opts.group === undefined ? {} : { group: opts.group }),
    },
  });

  // Зеркало ставим только для текущего турнира: запись команды в прошлый сезон не должна
  // переносить её из актуальной таблицы в архивную.
  const current = await currentTournament();
  if (current?.id === division.tournamentId)
    await prisma.team.update({ where: { id: teamId }, data: { group: division.name } });

  return entry;
}
