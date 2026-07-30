// Только сервер: рейтинги турнира — «кто больше всех убил / нанёс урона / настакал» в разрезе
// дивизиона и стадии. Считается из `MatchStat` карт, привязанных к сериям (src/lib/series.ts).
//
// Почему считаем, а не храним: единственная запись правды — стата карты. Любой хранимый итог
// пришлось бы пересчитывать после каждой привязки и каждого допарса реплея, и он бы молча
// разъезжался. Строк тут сотни, не миллионы — суммировать в памяти дешевле, чем поддерживать кэш.
//
// Разрез стадии — через `Match.series.stage`: карта без серии в рейтинги не попадает вообще,
// иначе в «Плей-офф» протекли бы товарищеские и тестовые матчи.

import { prisma } from "@/lib/prisma";
import { teamTag } from "@/lib/profiles";
import type { Bracket, Stage } from "@/lib/stages";

/** Суммы по одному субъекту (игроку или команде). Всё, из чего собираются рейтинги. */
export type Totals = {
  games: number;
  wins: number;
  durationSec: number;
  kills: number;
  deaths: number;
  assists: number;
  heroDamage: number;
  heroHealing: number;
  towerDamage: number;
  netWorth: number;
  lastHits: number;
  denies: number;
  campsStacked: number;
  obsPlaced: number;
  senPlaced: number;
};

const EMPTY: Totals = {
  games: 0,
  wins: 0,
  durationSec: 0,
  kills: 0,
  deaths: 0,
  assists: 0,
  heroDamage: 0,
  heroHealing: 0,
  towerDamage: 0,
  netWorth: 0,
  lastHits: 0,
  denies: 0,
  campsStacked: 0,
  obsPlaced: 0,
  senPlaced: 0,
};

export type Subject = {
  kind: "player" | "team";
  id: number;
  name: string;
  /** Игрок — тег его команды, команда — свой; пусто, если команда не определилась. */
  tag: string;
  totals: Totals;
};

export type LeadersFilter = { division?: string; stage?: Stage; group?: string; bracket?: Bracket };

/**
 * Метрика рейтинга. `sum` — «за турнир», `avg` — «за карту»: у команд, сыгравших разное число карт,
 * сравнивать голые суммы нечестно, поэтому обе колонки показываем рядом, а сортируем по `value`.
 * `parsedOnly` помечает то, чего нет у нераспарсенных матчей — в интерфейсе к ним идёт сноска.
 */
export type Metric = {
  key: string;
  label: string;
  hint: string;
  /** По чему сортируем и что показываем крупно. */
  value: (t: Totals) => number;
  /** Подпись под значением; null — второй строки нет. */
  per?: (t: Totals) => number;
  perLabel?: string;
  decimals?: number;
  parsedOnly?: boolean;
};

const perGame = (pick: (t: Totals) => number) => (t: Totals) => (t.games ? pick(t) / t.games : 0);

export const METRICS: Metric[] = [
  { key: "kills", label: "Убийства", hint: "Суммарно за турнир", value: (t) => t.kills, per: perGame((t) => t.kills), perLabel: "за карту" },
  { key: "assists", label: "Ассисты", hint: "Суммарно за турнир", value: (t) => t.assists, per: perGame((t) => t.assists), perLabel: "за карту" },
  {
    key: "kda",
    label: "KDA",
    hint: "(убийства + помощь) / смерти, смерти считаем минимум за одну",
    value: (t) => (t.kills + t.assists) / Math.max(1, t.deaths),
    per: (t) => t.deaths,
    perLabel: "смертей",
    decimals: 2,
  },
  { key: "heroDamage", label: "Урон по героям", hint: "Суммарно за турнир", value: (t) => t.heroDamage, per: perGame((t) => t.heroDamage), perLabel: "за карту" },
  {
    key: "damagePerMin",
    label: "Урон в минуту",
    hint: "Урон по героям, делённый на сыгранное время — длинные игры не дают форы",
    value: (t) => (t.durationSec ? (t.heroDamage / t.durationSec) * 60 : 0),
    per: perGame((t) => t.heroDamage),
    perLabel: "за карту",
  },
  { key: "towerDamage", label: "Урон по строениям", hint: "Суммарно за турнир", value: (t) => t.towerDamage, per: perGame((t) => t.towerDamage), perLabel: "за карту" },
  { key: "heroHealing", label: "Лечение", hint: "Суммарно за турнир", value: (t) => t.heroHealing, per: perGame((t) => t.heroHealing), perLabel: "за карту" },
  { key: "netWorth", label: "Нажито", hint: "Net worth на конец карты, суммарно", value: (t) => t.netWorth, per: perGame((t) => t.netWorth), perLabel: "за карту" },
  { key: "lastHits", label: "Добито крипов", hint: "Last hits", value: (t) => t.lastHits, per: perGame((t) => t.lastHits), perLabel: "за карту" },
  { key: "denies", label: "Денаи", hint: "Суммарно за турнир", value: (t) => t.denies, per: perGame((t) => t.denies), perLabel: "за карту" },
  { key: "campsStacked", label: "Стаки лагерей", hint: "Есть только у распарсенных матчей", value: (t) => t.campsStacked, per: perGame((t) => t.campsStacked), perLabel: "за карту", parsedOnly: true },
  { key: "wards", label: "Варды", hint: "Обсы + сентри; есть только у распарсенных матчей", value: (t) => t.obsPlaced + t.senPlaced, per: perGame((t) => t.obsPlaced + t.senPlaced), perLabel: "за карту", parsedOnly: true },
  {
    key: "winrate",
    label: "Винрейт",
    hint: "Доля выигранных карт; при равенстве выше тот, кто сыграл больше",
    value: (t) => (t.games ? (t.wins / t.games) * 100 : 0),
    per: (t) => t.games,
    perLabel: "карт",
    decimals: 1,
  },
];

export const metricByKey = (key: string) => METRICS.find((m) => m.key === key) ?? METRICS[0];

const add = (a: Totals, b: Partial<Totals>): Totals => {
  const out = { ...a };
  for (const k of Object.keys(EMPTY) as (keyof Totals)[]) out[k] += b[k] ?? 0;
  return out;
};

export type LeadersData = {
  players: Subject[];
  teams: Subject[];
  /** Сколько карт вообще попало в выборку и сколько из них распарсено — для сноски о варадах/стаках. */
  games: number;
  parsedGames: number;
};

/**
 * Собрать суммы по игрокам и командам. Возвращаем субъектов целиком, а рейтинг по конкретной
 * метрике страница строит сама: считать одно и то же тринадцать раз ради тринадцати таблиц незачем.
 */
export async function getLeaders(filter: LeadersFilter = {}): Promise<LeadersData> {
  const stats = await prisma.matchStat.findMany({
    where: {
      match: {
        // Карта без серии в рейтинг не идёт: у неё нет ни дивизиона, ни стадии.
        series: { is: { division: filter.division, stage: filter.stage, group: filter.group, bracket: filter.bracket } },
      },
    },
    select: {
      playerId: true,
      won: true,
      kills: true,
      deaths: true,
      assists: true,
      heroDamage: true,
      heroHealing: true,
      towerDamage: true,
      netWorth: true,
      lastHits: true,
      denies: true,
      campsStacked: true,
      obsPlaced: true,
      senPlaced: true,
      player: { select: { id: true, nickname: true } },
      match: {
        select: {
          id: true,
          durationSec: true,
          teamAId: true,
          teamBId: true,
          winnerTeamId: true,
          teamA: { select: { id: true, name: true, tag: true } },
          teamB: { select: { id: true, name: true, tag: true } },
        },
      },
    },
  });

  const players = new Map<number, Subject>();
  const teams = new Map<number, Subject>();
  const matches = new Map<number, boolean>(); // id карты → распарсена ли (по косвенному признаку)
  // Команду набивают пять строк на карту, поэтому «сыграно» и «время» ей считаем не сложением,
  // а по множеству карт — иначе средние за карту оказались бы впятеро занижены.
  const teamGames = new Map<number, Map<number, number>>(); // teamId → (matchId → длительность)
  const winnerOf = new Map<number, number | null>();

  for (const s of stats) {
    const m = s.match;
    // Команда игрока: победитель, если карта выиграна, иначе вторая из двух. Стороны в строке
    // статы нет намеренно — «кто выиграл» уже записано, и этого достаточно.
    const own =
      m.winnerTeamId == null ? null
      : s.won ? [m.teamA, m.teamB].find((t) => t.id === m.winnerTeamId) ?? null
      : [m.teamA, m.teamB].find((t) => t.id !== m.winnerTeamId) ?? null;

    const row: Partial<Totals> = {
      games: 1,
      wins: s.won ? 1 : 0,
      durationSec: m.durationSec ?? 0,
      kills: s.kills,
      deaths: s.deaths,
      assists: s.assists,
      heroDamage: s.heroDamage,
      heroHealing: s.heroHealing,
      towerDamage: s.towerDamage,
      netWorth: s.netWorth,
      lastHits: s.lastHits,
      denies: s.denies,
      campsStacked: s.campsStacked,
      obsPlaced: s.obsPlaced,
      senPlaced: s.senPlaced,
    };

    const p = players.get(s.playerId) ?? {
      kind: "player" as const,
      id: s.playerId,
      name: s.player.nickname,
      tag: own ? teamTag(own) : "",
      totals: EMPTY,
    };
    players.set(s.playerId, { ...p, tag: p.tag || (own ? teamTag(own) : ""), totals: add(p.totals, row) });

    if (own) {
      const t = teams.get(own.id) ?? { kind: "team" as const, id: own.id, name: own.name, tag: teamTag(own), totals: EMPTY };
      teams.set(own.id, { ...t, totals: add(t.totals, { ...row, games: 0, wins: 0, durationSec: 0 }) });
      if (!teamGames.has(own.id)) teamGames.set(own.id, new Map());
      teamGames.get(own.id)!.set(m.id, m.durationSec ?? 0);
    }

    // Признак распарсенной карты: варды и стаки приходят только из реплея. Ноль у всей пятёрки
    // сразу — почти наверняка непарс, а не десять человек без единого варда.
    matches.set(m.id, (matches.get(m.id) ?? false) || s.obsPlaced + s.senPlaced + s.campsStacked > 0);
    winnerOf.set(m.id, m.winnerTeamId);
  }

  for (const [id, t] of teams) {
    const own = teamGames.get(id) ?? new Map<number, number>();
    const wins = [...own.keys()].filter((mid) => winnerOf.get(mid) === id).length;
    teams.set(id, {
      ...t,
      totals: { ...t.totals, games: own.size, wins, durationSec: [...own.values()].reduce((a, b) => a + b, 0) },
    });
  }

  return {
    players: [...players.values()],
    teams: [...teams.values()],
    games: matches.size,
    parsedGames: [...matches.values()].filter(Boolean).length,
  };
}
