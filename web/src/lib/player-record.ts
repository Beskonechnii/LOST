// Только сервер: «карьерка» игрока в лиге из `MatchStat` — сыграно / побед / поражений
// и топ совместных игроков. Кирпич под сортировку списка ростера (§ 2.1) и блок тиммейтов
// в карточке игрока (§ 2.3).
//
// Почему тут, а не в leaders.ts: leaders считает суммы по метрикам для рейтингов; здесь нужен
// другой срез — счётчик игр по игроку и попарные совместные карты. Логика непохожая, файл свой.
//
// Тиммейты по трюку из leaders.ts: сторона игрока в строке статы не хранится, но `won` её задаёт —
// на одной карте игроки с одинаковым `won` играли за одну команду. Значит (matchId, won) —
// ключ «состав на карте»; кто ещё в этом ключе, тот и тиммейт.

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

export type Teammate = {
  playerId: number;
  nickname: string;
  /** Сколько карт сыграно вместе (за одну команду). */
  games: number;
  /** Из них выиграно вместе. */
  wins: number;
};

const where = (filter: LeadersFilter) => ({
  match: { series: { is: { division: filter.division, stage: filter.stage, group: filter.group, bracket: filter.bracket } } },
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

/**
 * Топ совместных игроков для одного игрока: с кем больше всего сыграно за одну команду.
 * Тянем не только строки игрока, а все составы карт, где он был — иначе не с кем его сводить.
 */
export async function getTeammates(playerId: number, filter: LeadersFilter = {}, limit = 5): Promise<Teammate[]> {
  // Карты и стороны, где играл наш игрок: набор ключей (matchId, won).
  const mine = await prisma.matchStat.findMany({
    where: { playerId, ...where(filter) },
    select: { matchId: true, won: true },
  });
  if (mine.length === 0) return [];

  const sideOf = new Map<number, boolean>(); // matchId → его сторона (won) на этой карте
  for (const m of mine) sideOf.set(m.matchId, m.won);

  // Все строки этих карт: тиммейт = тот же matchId и та же сторона, но другой игрок.
  const rows = await prisma.matchStat.findMany({
    where: { matchId: { in: [...sideOf.keys()] } },
    select: { matchId: true, playerId: true, won: true, player: { select: { nickname: true } } },
  });

  const mates = new Map<number, Teammate>();
  for (const r of rows) {
    if (r.playerId === playerId) continue;
    if (sideOf.get(r.matchId) !== r.won) continue; // соперник, не тиммейт
    const t = mates.get(r.playerId) ?? { playerId: r.playerId, nickname: r.player.nickname, games: 0, wins: 0 };
    t.games += 1;
    if (r.won) t.wins += 1;
    mates.set(r.playerId, t);
  }

  return [...mates.values()].sort((a, b) => b.games - a.games || b.wins - a.wins).slice(0, limit);
}
