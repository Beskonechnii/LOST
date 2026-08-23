// Только сервер: полная турнирная картина одного игрока из `MatchStat` — сводка, разрез по
// турнирам (дивизион × стадия) и лента последних карт. Один заход в базу: строк у игрока
// десятки, дешевле вытащить все и посчитать в памяти, чем гонять три запроса (та же логика,
// что в leaders.ts и player-stats.ts — единственная запись правды это строка статы карты).
//
// «За какую команду» игрок сыграл карту берём из победителя, а не из ростера: winnerTeamId —
// одна из двух команд карты, а `won` строки статы говорит, на выигравшей стороне игрок или нет.
// Значит его команда = won ? winner : loser. Ростер тут не нужен и не соврёт на бывших составах.

import { prisma } from "@/lib/prisma";
import { heroBySlug } from "@/lib/opendota";
import { stageLabel, playoffLabel } from "@/lib/stages";

export type TeamBrief = { id: number; name: string; tag: string | null; slug: string; color: string | null };

export type PlayerGameRow = {
  matchId: number;
  openDotaMatchId: string | null;
  playedAt: Date | null;
  durationSec: number | null;
  heroSlug: string;
  heroName: string;
  kills: number;
  deaths: number;
  assists: number;
  gpm: number;
  xpm: number;
  won: boolean;
  /** Команда, за которую играл (по победителю карты); null — если победитель не проставлен. */
  myTeam: TeamBrief | null;
  opponent: TeamBrief | null;
  seriesSlug: string;
  division: string;
  /** Подпись стадии: «Группа A» / «Плей-офф · Полуфинал». */
  stageText: string;
};

/**
 * Строка разреза «турнир»: одна на дивизион турнира, стадии внутри слиты.
 *
 * Раньше строка была на стадию и заканчивалась иконкой самого играемого героя — герой здесь лишний
 * (для него есть свой блок), а разбивка на группу и плей-офф дробила и без того короткую таблицу.
 * Теперь на строку приходится то, что от неё и ждут: где играл, когда последний матч, чем кончились
 * встречи и карты.
 */
export type PlayerTournamentRow = {
  key: string;
  /** Турнир и его слаг — строка кликабельна, ведёт в раздел турнира. */
  tournament: string;
  tournamentSlug: string | null;
  division: string;
  /** Карты: сыграно, победы, поражения. */
  games: number;
  wins: number;
  losses: number;
  winrate: number;
  /** Встречи (серии) — то, чем турнир считается по регламенту. */
  series: { total: number; wins: number; losses: number };
  /** Когда сыграна последняя карта этого турнира; null — дат нет ни у одной. */
  lastPlayedAt: Date | null;
};

export type PlayerLeague = {
  summary: {
    games: number;
    wins: number;
    losses: number;
    winrate: number;
    /** Средние за карту: KDA, GPM, XPM, длительность. */
    kills: number;
    deaths: number;
    assists: number;
    gpm: number;
    xpm: number;
    avgDurationSec: number | null;
  };
  /** Разрез по турнирам: дивизионы в порядке появления, внутри — группа, затем плей-офф. */
  tournaments: PlayerTournamentRow[];
  /** Лента карт, свежие сверху. */
  games: PlayerGameRow[];
};

const brief = (t: { id: number; name: string; tag: string | null; slug: string; color: string | null } | null): TeamBrief | null =>
  t ? { id: t.id, name: t.name, tag: t.tag, slug: t.slug, color: t.color } : null;

const EMPTY: PlayerLeague = {
  summary: { games: 0, wins: 0, losses: 0, winrate: 0, kills: 0, deaths: 0, assists: 0, gpm: 0, xpm: 0, avgDurationSec: null },
  tournaments: [],
  games: [],
};

/** mm:ss из секунд; null — прочерк в UI. */
export const mmss = (sec: number | null | undefined) => {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

export async function getPlayerLeague(playerId: number, gamesLimit = 15): Promise<PlayerLeague> {
  // Команды игрока по ростеру — по ним определяем «за кого сыграна карта». Это надёжнее победителя:
  // winnerTeamId у части карт не проставлен, а членство в составе есть всегда. Победитель — фолбэк
  // для карт со стендином (игрок не в ростере ни одной из команд карты).
  const spots = await prisma.rosterSpot.findMany({ where: { playerId }, select: { teamId: true } });
  const myTeamIds = new Set(spots.map((s) => s.teamId));

  // Только карты, привязанные к серии турнира (как в leaders/player-stats): у карты без серии нет
  // ни дивизиона, ни стадии, и в турнирную картину она не входит.
  const teamSelect = { select: { id: true, name: true, tag: true, slug: true, color: true } };
  const stats = await prisma.matchStat.findMany({
    where: { playerId, match: { series: { isNot: null } } },
    select: {
      heroSlug: true,
      won: true,
      kills: true,
      deaths: true,
      assists: true,
      gpm: true,
      xpm: true,
      match: {
        select: {
          id: true,
          openDotaMatchId: true,
          startedAt: true,
          scheduledAt: true,
          durationSec: true,
          winnerTeamId: true,
          teamA: teamSelect,
          teamB: teamSelect,
          series: {
            select: {
              id: true,
              slug: true,
              homeId: true,
              awayId: true,
              homeScore: true,
              awayScore: true,
              division: true,
              divisionId: true,
              // Подпись разреза берём из самого дивизиона с турниром: имена дивизионов повторяются
              // из сезона в сезон, и по имени разрезы двух турниров слиплись бы в один.
              divisionRef: { select: { short: true, name: true, tournament: { select: { short: true, name: true, slug: true } } } },
              stage: true,
              group: true,
              bracket: true,
              round: true,
            },
          },
        },
      },
    },
  });
  if (stats.length === 0) return EMPTY;

  // --- Сводка (суммы, средние досчитаем в конце) ---
  const sum = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, gpm: 0, xpm: 0, dur: 0, durCount: 0 };

  // --- Разрез по турнирам: ключ — дивизион турнира (стадии внутри слиты) ---
  // Встречи считаем по сериям, а не по картам: в турнирной таблице команда получает очки за встречу,
  // и «5 побед» в профиле должно значить пять выигранных серий, а не пять взятых карт.
  type Bucket = {
    key: string;
    tournament: string;
    tournamentSlug: string | null;
    division: string;
    games: number;
    wins: number;
    lastPlayedAt: Date | null;
    series: Map<number, boolean | null>;
  };
  const buckets = new Map<string, Bucket>();

  // --- Лента карт ---
  const games: PlayerGameRow[] = [];

  for (const s of stats) {
    const m = s.match;
    const series = m.series!; // отфильтровали isNot: null, но типы этого не знают

    sum.games += 1;
    if (s.won) sum.wins += 1;
    sum.kills += s.kills;
    sum.deaths += s.deaths;
    sum.assists += s.assists;
    sum.gpm += s.gpm;
    sum.xpm += s.xpm;
    if (m.durationSec) {
      sum.dur += m.durationSec;
      sum.durCount += 1;
    }

    // Ключ разреза — id дивизиона, а не имя: «Division 1» есть в каждом сезоне.
    const key = String(series.divisionId ?? series.division);
    const tournamentName = series.divisionRef
      ? (series.divisionRef.tournament.short ?? series.divisionRef.tournament.name)
      : "Вне турнира";
    const shortDivision = series.divisionRef ? (series.divisionRef.short ?? series.divisionRef.name) : series.division;
    const divisionLabel = [tournamentName, shortDivision].filter(Boolean).join(" · ");
    const b = buckets.get(key) ?? {
      key,
      tournament: tournamentName,
      tournamentSlug: series.divisionRef?.tournament.slug ?? null,
      division: shortDivision,
      games: 0,
      wins: 0,
      lastPlayedAt: null,
      series: new Map<number, boolean | null>(),
    };
    b.games += 1;
    if (s.won) b.wins += 1;
    const playedAt = m.startedAt ?? m.scheduledAt;
    if (playedAt && (!b.lastPlayedAt || playedAt > b.lastPlayedAt)) b.lastPlayedAt = playedAt;
    // Исход встречи — по счёту серии глазами команды игрока. Команду берём из ростера; если игрок
    // стендинил и ни в одном из составов не значится, исход встречи не считаем (null).
    if (!b.series.has(series.id)) {
      const mineIsHome = series.homeId != null && myTeamIds.has(series.homeId);
      const mineIsAway = series.awayId != null && myTeamIds.has(series.awayId);
      const outcome =
        mineIsHome || mineIsAway
          ? mineIsHome
            ? series.homeScore > series.awayScore
            : series.awayScore > series.homeScore
          : null;
      b.series.set(series.id, outcome);
    }
    buckets.set(key, b);

    // Команда игрока и соперник: сначала по ростеру (в чьём составе игрок), иначе по победителю.
    let myTeam: TeamBrief | null = null;
    let opponent: TeamBrief | null = null;
    if (myTeamIds.has(m.teamA.id) || myTeamIds.has(m.teamB.id)) {
      const mine = myTeamIds.has(m.teamA.id) ? m.teamA : m.teamB;
      myTeam = brief(mine);
      opponent = brief(mine.id === m.teamA.id ? m.teamB : m.teamA);
    } else if (m.winnerTeamId != null) {
      const winner = m.winnerTeamId === m.teamA.id ? m.teamA : m.teamB;
      const loser = winner.id === m.teamA.id ? m.teamB : m.teamA;
      myTeam = brief(s.won ? winner : loser);
      opponent = brief(s.won ? loser : winner);
    }

    games.push({
      matchId: m.id,
      openDotaMatchId: m.openDotaMatchId,
      playedAt: m.startedAt ?? m.scheduledAt,
      durationSec: m.durationSec,
      heroSlug: s.heroSlug,
      heroName: s.heroSlug ? heroBySlug(s.heroSlug).name : "",
      kills: s.kills,
      deaths: s.deaths,
      assists: s.assists,
      gpm: s.gpm,
      xpm: s.xpm,
      won: s.won,
      myTeam,
      opponent,
      seriesSlug: series.slug,
      // Та же подпись, что и у разрезов: турнир + дивизион, иначе в ленте карт два сезона выглядят
      // как один «Division 1».
      division: divisionLabel,
      stageText: series.stage === "playoff" ? playoffLabel(series.bracket, series.round) || stageLabel(series.stage) : series.group ? `Группа ${series.group}` : stageLabel(series.stage),
    });
  }

  // Свежие сверху: у карт без даты — в конец.
  games.sort((a, b) => (b.playedAt?.getTime() ?? 0) - (a.playedAt?.getTime() ?? 0));

  const tournaments: PlayerTournamentRow[] = [...buckets.values()]
    // Свежий турнир сверху — по дате последней карты; без дат уходят вниз, там же алфавит.
    .sort(
      (a, b) =>
        (b.lastPlayedAt?.getTime() ?? 0) - (a.lastPlayedAt?.getTime() ?? 0) ||
        a.tournament.localeCompare(b.tournament) ||
        a.division.localeCompare(b.division),
    )
    .map((b) => {
      const outcomes = [...b.series.values()].filter((v): v is boolean => v !== null);
      return {
        key: b.key,
        tournament: b.tournament,
        tournamentSlug: b.tournamentSlug,
        division: b.division,
        games: b.games,
        wins: b.wins,
        losses: b.games - b.wins,
        winrate: b.games ? (b.wins / b.games) * 100 : 0,
        series: {
          total: b.series.size,
          wins: outcomes.filter(Boolean).length,
          losses: outcomes.filter((v) => !v).length,
        },
        lastPlayedAt: b.lastPlayedAt,
      };
    });

  return {
    summary: {
      games: sum.games,
      wins: sum.wins,
      losses: sum.games - sum.wins,
      winrate: sum.games ? (sum.wins / sum.games) * 100 : 0,
      kills: sum.kills / sum.games,
      deaths: sum.deaths / sum.games,
      assists: sum.assists / sum.games,
      gpm: Math.round(sum.gpm / sum.games),
      xpm: Math.round(sum.xpm / sum.games),
      avgDurationSec: sum.durCount ? Math.round(sum.dur / sum.durCount) : null,
    },
    tournaments,
    games: games.slice(0, gamesLimit),
  };
}
