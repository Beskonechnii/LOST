// Только сервер: «карьерка» игрока в лиге из `MatchStat` — сыграно / побед / поражений.
// Кирпич под сортировку списка ростера и карточку игрока.
//
// Почему тут, а не в leaders.ts: leaders считает суммы по метрикам для рейтингов; здесь нужен
// другой срез — счётчик игр по игроку. Логика непохожая, файл свой.
//
// Блок «Чаще всего играет с» с витрины убран (23.08.2026), вместе с ним ушёл и расчёт тиммейтов:
// на странице игрока он занимал место, которое нужнее турниру, героям и последним играм.

import { prisma } from "@/lib/prisma";
import type { LeadersFilter } from "@/lib/leaders";

export type PlayerRecord = {
  playerId: number;
  games: number;
  wins: number;
  losses: number;
  /** Доля побед, 0..100. */
  winrate: number;
};

const where = (filter: LeadersFilter) => ({
  match: { series: { is: { divisionId: filter.divisionId, stage: filter.stage, group: filter.group, bracket: filter.bracket } } },
});

/**
 * Записи всех игроков (или заданного набора) за один запрос — для сортировки списка ростера.
 * Пустой `playerIds` = все, у кого есть стата.
 */
export async function getPlayerRecords(playerIds: number[] | null, filter: LeadersFilter = {}): Promise<Map<number, PlayerRecord>> {
  const rows = await prisma.matchStat.groupBy({
    by: ["playerId", "won"],
    where: { ...(playerIds ? { playerId: { in: playerIds } } : {}), ...where(filter) },
    _count: { _all: true },
  });

  const out = new Map<number, PlayerRecord>();
  for (const r of rows) {
    const rec = out.get(r.playerId) ?? { playerId: r.playerId, games: 0, wins: 0, losses: 0, winrate: 0 };
    const n = r._count._all;
    rec.games += n;
    if (r.won) rec.wins += n;
    else rec.losses += n;
    out.set(r.playerId, rec);
  }
  for (const rec of out.values()) rec.winrate = rec.games ? (rec.wins / rec.games) * 100 : 0;
  return out;
}

/** Запись одного игрока (сахар). Нет статы — нули. */
export async function getPlayerRecord(playerId: number, filter: LeadersFilter = {}): Promise<PlayerRecord> {
  const map = await getPlayerRecords([playerId], filter);
  return map.get(playerId) ?? { playerId, games: 0, wins: 0, losses: 0, winrate: 0 };
}
