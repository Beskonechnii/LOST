// Только сервер: архив серий — чтение и правка встреч любой стадии плюс привязка карт.
//
// Серия (`Series`) — единственный контейнер отыгранной встречи: из неё считается и сетка группы
// (src/lib/group-stage.ts), и таблица лиги (src/lib/standings.ts), и рейтинги (src/lib/leaders.ts).
// Карта попадает в архив только отсюда: `attachGame` заводит `Match` и зовёт синк статы.

import { prisma } from "@/lib/prisma";
import { syncMatch } from "@/lib/match-sync";
import { teamTag } from "@/lib/profiles";
import { bracketOfRound, isStage, type Bracket, type Stage } from "@/lib/stages";
import { resolveUpload } from "@/lib/uploads";

export type SeriesGame = {
  matchId: number;
  gameNumber: number | null;
  openDotaMatchId: string | null;
  durationSec: number | null;
  startedAt: Date | null;
  winnerTeamId: number | null;
  statsCount: number;
};

export type SeriesRow = {
  id: number;
  /** Ключ адреса `/series/<slug>` — переживает `db:import`, в отличие от `id`. */
  slug: string;
  division: string;
  stage: string;
  group: string | null;
  bracket: string | null;
  round: string | null;
  playedAt: Date | null;
  guessed: boolean;
  home: { id: number; name: string; tag: string; logo: string | null };
  away: { id: number; name: string; tag: string; logo: string | null };
  homeScore: number;
  awayScore: number;
  games: SeriesGame[];
};

const teamSelect = { select: { id: true, slug: true, name: true, tag: true, logo: true } } as const;

/** Счёт серии Bo3 — только эти исходы; всё прочее ломает формулу очков (см. qualification.ts). */
export const VALID_SCORES = ["2:0", "2:1", "1:2", "0:2"];

export type SeriesFilter = { id?: number; slug?: string; division?: string; stage?: Stage; group?: string; bracket?: Bracket; teamId?: number };

/**
 * Серии по фильтру, свежие сверху. `playedAt` заполняется не всегда (групповую стадию заливали
 * снимком таблицы, без дат), поэтому вторым ключом идёт id — иначе порядок скачет между запросами.
 */
export async function listSeries(filter: SeriesFilter = {}): Promise<SeriesRow[]> {
  const rows = await prisma.series.findMany({
    where: {
      id: filter.id,
      slug: filter.slug,
      division: filter.division,
      stage: filter.stage,
      group: filter.group,
      bracket: filter.bracket,
      ...(filter.teamId ? { OR: [{ homeId: filter.teamId }, { awayId: filter.teamId }] } : {}),
    },
    include: {
      home: teamSelect,
      away: teamSelect,
      games: { orderBy: { gameNumber: "asc" }, include: { _count: { select: { stats: true } } } },
    },
    orderBy: [{ playedAt: "desc" }, { id: "desc" }],
  });

  // Лого резолвятся файлами на диске — разом до сборки, чтобы не сыпать await в цикле.
  const logos = new Map(
    await Promise.all(
      rows
        .flatMap((r) => [r.home, r.away])
        .map(async (t) => [t.id, await resolveUpload("teams", t.slug, "logo", t.logo)] as const),
    ),
  );
  const team = (t: { id: number; name: string; tag: string | null }) => ({
    id: t.id,
    name: t.name,
    tag: teamTag(t),
    logo: logos.get(t.id) ?? null,
  });

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    division: r.division,
    stage: r.stage,
    group: r.group,
    bracket: r.bracket,
    round: r.round,
    playedAt: r.playedAt,
    guessed: r.guessed,
    home: team(r.home),
    away: team(r.away),
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    games: r.games.map((g) => ({
      matchId: g.id,
      gameNumber: g.gameNumber,
      openDotaMatchId: g.openDotaMatchId,
      durationSec: g.durationSec,
      startedAt: g.startedAt,
      winnerTeamId: g.winnerTeamId,
      statsCount: g._count.stats,
    })),
  }));
}

/** Встреча по ключу из адреса: слаг, либо (для старых ссылок и админки) числовой id. */
export async function getSeries(key: string | number): Promise<SeriesRow | null> {
  const id = typeof key === "number" ? key : /^\d+$/.test(key) ? Number(key) : undefined;
  const [row] = await listSeries(id !== undefined ? { id } : { slug: String(key) });
  return row ?? null;
}

/**
 * Слаг встречи: `<хозяева>-vs-<гости>` по слагам команд — сквозному ключу проекта.
 * Одна и та же пара может сыграть дважды (группа и плей-офф, верхняя сетка и гранд-финал),
 * поэтому занятый слаг получает числовой хвост. Считается один раз при создании и дальше живёт
 * в базе: пересчитывать его при правке значило бы ломать уже отданные наружу ссылки.
 */
async function uniqueSlug(homeId: number, awayId: number): Promise<string> {
  const teams = await prisma.team.findMany({ where: { id: { in: [homeId, awayId] } }, select: { id: true, slug: true } });
  const slugOf = (id: number) => teams.find((t) => t.id === id)?.slug ?? String(id);
  const base = `${slugOf(homeId)}-vs-${slugOf(awayId)}`;

  const taken = new Set(
    (await prisma.series.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map((s) => s.slug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

// --- Развёрнутая серия для публичной страницы ---

export type GamePlayer = {
  playerId: number;
  nickname: string;
  heroSlug: string;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  netWorth: number;
};

/** Карта глазами страницы серии: обе стороны с составами, счёт по убийствам, кто был за свет. */
export type SeriesGameDetail = SeriesGame & {
  radiantTeamId: number | null;
  radiantScore: number | null;
  direScore: number | null;
  firstPickRadiant: boolean | null;
  /** Игроки по командам — ключ совпадает с `home.id`/`away.id` серии. */
  byTeam: Record<number, GamePlayer[]>;
};

export type SeriesDetail = Omit<SeriesRow, "games"> & { games: SeriesGameDetail[] };

/**
 * Серия со всеми составами. Отдельно от `listSeries` намеренно: списку архива стата игроков не нужна,
 * а тянуть её на сотню серий — лишние сотни строк на каждый рендер списка.
 *
 * Команда игрока выводится из `won` + победителя карты: стороны в строке статы нет, и заводить её
 * ради этого не стоит — «кто выиграл» уже записано, а команд в карте ровно две.
 */
export async function getSeriesDetail(key: string | number): Promise<SeriesDetail | null> {
  const base = await getSeries(key);
  if (!base) return null;

  const games = await prisma.match.findMany({
    where: { seriesId: base.id },
    orderBy: { gameNumber: "asc" },
    include: { stats: { include: { player: { select: { id: true, nickname: true } } } } },
  });

  return {
    ...base,
    games: games.map((g) => {
      const byTeam: Record<number, GamePlayer[]> = { [base.home.id]: [], [base.away.id]: [] };
      for (const s of g.stats) {
        const teamId =
          g.winnerTeamId == null ? base.home.id
          : s.won ? g.winnerTeamId
          : g.winnerTeamId === base.home.id ? base.away.id
          : base.home.id;
        byTeam[teamId]?.push({
          playerId: s.player.id,
          nickname: s.player.nickname,
          heroSlug: s.heroSlug,
          level: s.level,
          kills: s.kills,
          deaths: s.deaths,
          assists: s.assists,
          netWorth: s.netWorth,
        });
      }
      // Внутри команды — по уровню вниз, как в постгейме: это грубый, но читаемый порядок «кор → саппорт».
      for (const list of Object.values(byTeam)) list.sort((a, b) => b.level - a.level || b.netWorth - a.netWorth);

      return {
        matchId: g.id,
        gameNumber: g.gameNumber,
        openDotaMatchId: g.openDotaMatchId,
        durationSec: g.durationSec,
        startedAt: g.startedAt,
        winnerTeamId: g.winnerTeamId,
        statsCount: g.stats.length,
        radiantTeamId: g.radiantTeamId,
        radiantScore: g.radiantScore,
        direScore: g.direScore,
        firstPickRadiant: g.firstPickRadiant,
        byTeam,
      };
    }),
  };
}

export type NewSeries = {
  division: string;
  stage: string;
  group?: string | null;
  round?: string | null;
  playedAt?: Date | null;
  homeId: number;
  awayId: number;
  score: string;
};

/** Завести встречу руками. Групповые уже залиты импортом — это в первую очередь про плей-офф. */
export async function createSeries(input: NewSeries) {
  if (!isStage(input.stage)) throw new Error(`Неизвестная стадия: «${input.stage}»`);
  if (!VALID_SCORES.includes(input.score)) {
    throw new Error(`Счёт серии должен быть ${VALID_SCORES.join(", ")} — не «${input.score}»`);
  }
  if (input.homeId === input.awayId) throw new Error("Команда не играет сама с собой");
  if (input.stage === "group" && !input.group) throw new Error("У групповой встречи должна быть группа");

  const [homeScore, awayScore] = input.score.split(":").map(Number);
  return prisma.series.create({
    data: {
      slug: await uniqueSlug(input.homeId, input.awayId),
      division: input.division,
      stage: input.stage,
      // У плей-офф группы нет — пустую строку из формы приводим к NULL, иначе сломается @@unique.
      group: input.stage === "group" ? input.group! : null,
      // Половину сетки не спрашиваем отдельно: её однозначно задаёт выбранный раунд.
      bracket: input.stage === "playoff" && input.round ? bracketOfRound(input.round) : null,
      round: input.round || null,
      playedAt: input.playedAt ?? null,
      homeId: input.homeId,
      awayId: input.awayId,
      homeScore,
      awayScore,
      guessed: false, // завели руками — значит, знаем наверняка
    },
  });
}

/**
 * Привязать карту к серии: заводим `Match` под её командами и тут же читаем стату.
 *
 * `openDotaMatchId` уникален глобально, поэтому одна и та же карта не ляжет в две серии — повторная
 * привязка переносит существующий матч, а не плодит дубль. Стороны (кто был за свет) определяет
 * синк по составам, руками их вводить не нужно.
 */
export async function attachGame(seriesId: number, gameNumber: number, openDotaMatchId: string) {
  if (!/^\d{1,20}$/.test(openDotaMatchId)) throw new Error("ID матча — это число, например 8907510684");
  if (gameNumber < 1 || gameNumber > 5) throw new Error("Номер карты в серии — от 1 до 5");

  const series = await prisma.series.findUnique({ where: { id: seriesId } });
  if (!series) throw new Error(`Серия ${seriesId} не найдена`);

  const existing = await prisma.match.findUnique({ where: { openDotaMatchId } });
  const match = existing
    ? await prisma.match.update({
        where: { id: existing.id },
        data: { seriesId, gameNumber, teamAId: series.homeId, teamBId: series.awayId },
      })
    : await prisma.match.create({
        data: {
          openDotaMatchId,
          seriesId,
          gameNumber,
          teamAId: series.homeId,
          teamBId: series.awayId,
          status: "finished",
        },
      });

  const synced = await syncMatch(prisma, match.id);

  // Дата серии — по первой карте: вводить её руками смысла нет, она уже есть в отчёте.
  if (!series.playedAt) {
    const first = await prisma.match.findFirst({
      where: { seriesId, startedAt: { not: null } },
      orderBy: { startedAt: "asc" },
    });
    if (first?.startedAt) await prisma.series.update({ where: { id: seriesId }, data: { playedAt: first.startedAt } });
  }

  return synced;
}

/** Отцепить карту: матч и его стата уходят целиком (на них ничего, кроме архива, не держится). */
export async function detachGame(matchId: number) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { renders: true, pointsEntries: true } });
  if (!match) throw new Error(`Матч ${matchId} не найден`);
  // На матче могут висеть генерации и баллы — их удалять нельзя, поэтому просто снимаем с серии.
  if (match.renders.length || match.pointsEntries.length) {
    return prisma.match.update({ where: { id: matchId }, data: { seriesId: null, gameNumber: null } });
  }
  return prisma.match.delete({ where: { id: matchId } });
}
