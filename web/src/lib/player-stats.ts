// Только сервер: агрегация «игрок × герой» из `MatchStat`. Кирпич, на котором стоят
// сигнатурные герои в карточке игрока (§ ростер) и плашка «турнирный винрейт на этом герое»
// в инфографике карты (§ ТГ-бот).
//
// Почему считаем, а не храним — та же причина, что у leaders.ts: единственная запись правды —
// строка статы карты. Любой хранимый итог по герою пришлось бы пересчитывать после каждой
// привязки и перечитки реплея, и он бы молча разъезжался. Строк сотни — суммировать дёшево.
//
// Разрез такой же, как в рейтингах: карта без серии в счёт не идёт (у неё нет ни дивизиона,
// ни стадии), фильтр `LeadersFilter` переиспользуем один в один.

import { prisma } from "@/lib/prisma";
import { heroBySlug } from "@/lib/opendota";
import type { LeadersFilter } from "@/lib/leaders";

/** Итоги игрока на одном герое. Винрейт — производное, но кладём рядом, чтобы не считать в UI. */
export type HeroLine = {
  slug: string;
  /** Человеческое имя героя из константы (heroBySlug); пусто — если герой не распознан. */
  name: string;
  games: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  /** Доля выигранных карт на этом герое, 0..100. */
  winrate: number;
};

export type PlayerHeroes = {
  playerId: number;
  /** Все герои игрока, по убыванию числа игр. */
  heroes: HeroLine[];
  /**
   * Сигнатурные — топ по винрейту среди героев, сыгранных не меньше `minGames` раз.
   * Порог нужен, чтобы «100% на одной игре» не вытеснял реально наигранного героя.
   * При равном винрейте выше тот, у кого больше игр.
   */
  signature: HeroLine[];
};

const winrate = (wins: number, games: number) => (games ? (wins / games) * 100 : 0);

/**
 * Собрать разбивку по героям для набора игроков за один запрос. Батч, потому что список ростера
 * зовёт это на десятки карточек сразу — по запросу на игрока было бы N обращений к базе.
 * Пустой `playerIds` = все игроки, у кого есть стата (для карточки одного игрока передаём [id]).
 */
export async function getPlayersHeroes(
  playerIds: number[] | null,
  filter: LeadersFilter = {},
  opts: { signatureSize?: number; minGames?: number } = {},
): Promise<Map<number, PlayerHeroes>> {
  const { signatureSize = 5, minGames = 2 } = opts;

  const stats = await prisma.matchStat.findMany({
    where: {
      ...(playerIds ? { playerId: { in: playerIds } } : {}),
      // Тот же барьер, что в leaders.ts: только карты, привязанные к серии турнира.
      match: {
        series: { is: { division: filter.division, stage: filter.stage, group: filter.group, bracket: filter.bracket } },
      },
    },
    select: { playerId: true, heroSlug: true, won: true, kills: true, deaths: true, assists: true },
  });

  // playerId → (heroSlug → накопитель)
  const byPlayer = new Map<number, Map<string, HeroLine>>();
  for (const s of stats) {
    if (!s.heroSlug) continue; // строка без героя в разбивку по героям не годится
    const heroes = byPlayer.get(s.playerId) ?? new Map<string, HeroLine>();
    const line =
      heroes.get(s.heroSlug) ??
      ({ slug: s.heroSlug, name: heroBySlug(s.heroSlug).name, games: 0, wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0, winrate: 0 } as HeroLine);
    line.games += 1;
    line.wins += s.won ? 1 : 0;
    line.losses += s.won ? 0 : 1;
    line.kills += s.kills;
    line.deaths += s.deaths;
    line.assists += s.assists;
    heroes.set(s.heroSlug, line);
    byPlayer.set(s.playerId, heroes);
  }

  const out = new Map<number, PlayerHeroes>();
  for (const [playerId, heroes] of byPlayer) {
    const all = [...heroes.values()];
    for (const h of all) h.winrate = winrate(h.wins, h.games);
    all.sort((a, b) => b.games - a.games);
    const signature = all
      .filter((h) => h.games >= minGames)
      .sort((a, b) => b.winrate - a.winrate || b.games - a.games)
      .slice(0, signatureSize);
    out.set(playerId, { playerId, heroes: all, signature });
  }
  return out;
}

/** Разбивка по героям одного игрока (сахар над батчем). Нет статы — пустые массивы. */
export async function getPlayerHeroes(
  playerId: number,
  filter: LeadersFilter = {},
  opts: { signatureSize?: number; minGames?: number } = {},
): Promise<PlayerHeroes> {
  const map = await getPlayersHeroes([playerId], filter, opts);
  return map.get(playerId) ?? { playerId, heroes: [], signature: [] };
}
