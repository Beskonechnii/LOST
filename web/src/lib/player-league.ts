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

/** Строка разреза «турнир»: дивизион + стадия, с карьеркой и самым играемым героем. */
export type PlayerTournamentRow = {
  division: string;
  stage: string; // group | playoff
  label: string; // «Групповая стадия» / «Плей-офф»
  games: number;
  wins: number;
  losses: number;
  winrate: number;
  topHero: { slug: string; name: string; games: number } | null;
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
          series: { select: { slug: true, division: true, stage: true, group: true, bracket: true, round: true } },
        },
      },
    },
  });
  if (stats.length === 0) return EMPTY;

  // --- Сводка (суммы, средние досчитаем в конце) ---
  const sum = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, gpm: 0, xpm: 0, dur: 0, durCount: 0 };

  // --- Разрез по турнирам: ключ «division|stage» ---
  type Bucket = { division: string; stage: string; games: number; wins: number; heroes: Map<string, number> };
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

    const key = `${series.division}|${series.stage}`;
    const b = buckets.get(key) ?? { division: series.division, stage: series.stage, games: 0, wins: 0, heroes: new Map() };
    b.games += 1;
    if (s.won) b.wins += 1;
    if (s.heroSlug) b.heroes.set(s.heroSlug, (b.heroes.get(s.heroSlug) ?? 0) + 1);
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
      division: series.division,
      stageText: series.stage === "playoff" ? playoffLabel(series.bracket, series.round) || stageLabel(series.stage) : series.group ? `Группа ${series.group}` : stageLabel(series.stage),
    });
  }

  // Свежие сверху: у карт без даты — в конец.
  games.sort((a, b) => (b.playedAt?.getTime() ?? 0) - (a.playedAt?.getTime() ?? 0));

  const tournaments: PlayerTournamentRow[] = [...buckets.values()]
    // Дивизион по алфавиту (D1 раньше D2), внутри — группа перед плей-оффом.
    .sort((a, b) => a.division.localeCompare(b.division) || (a.stage === "group" ? -1 : 1) - (b.stage === "group" ? -1 : 1))
    .map((b) => {
      const top = [...b.heroes.entries()].sort((x, y) => y[1] - x[1])[0] ?? null;
      return {
        division: b.division,
        stage: b.stage,
        label: b.stage === "group" ? "Групповая стадия" : b.stage === "playoff" ? "Плей-офф" : stageLabel(b.stage),
        games: b.games,
        wins: b.wins,
        losses: b.games - b.wins,
        winrate: b.games ? (b.wins / b.games) * 100 : 0,
        topHero: top ? { slug: top[0], name: heroBySlug(top[0]).name, games: top[1] } : null,
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
