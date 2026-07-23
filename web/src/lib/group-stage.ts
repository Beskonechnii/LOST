// Групповая стадия: снимок результатов из таблицы сезона (вкладка «GS») + сетка личных встреч.
// Живая таблица лиги считается отдельно — в standings.ts; здесь этап, который уже отыгран.

import { prisma } from "@/lib/prisma";

/**
 * Очки за серию Bo3. Формула выведена из таблицы сезона и сошлась на всех командах группы A
 * первого дивизиона (ГУЗЛИКИ 15, Ethereal 15, 5KN 2), поэтому считаем её правилом лиги:
 * 2:0 → 3, 2:1 → 2, 1:2 → 1, 0:2 → 0. Идея — «сухая» победа дороже, а взятая карта не пропадает.
 */
export function seriesPoints(own: number, opp: number) {
  if (own > opp) return opp === 0 ? 3 : 2;
  return own === 0 ? 0 : 1;
}

export type GroupRow = {
  teamId: number;
  name: string;
  tag: string | null;
  logo: string | null;
  place: number;
  /** Считается из сетки — поэтому правка встречи сразу видна и здесь, и в таблице лиги. */
  played: number;
  wins: number;
  losses: number;
  points: number;
  /** Как напечатано в таблице сезона. Расходится — значит сетку правили; показываем оба числа. */
  sheet: { played: number; wins: number; losses: number; points: number };
};

/** Ячейка сетки. `flipped` — встреча хранится с другой стороны, показываем её зеркально. */
export type GroupCell = { id: number; score: string; guessed: boolean; flipped: boolean } | null;

export type GroupTable = {
  division: string;
  group: string;
  rows: GroupRow[];
  /** Матрица [строка][столбец] в порядке rows: счёт серии глазами команды-строки. */
  grid: GroupCell[][];
  /** Сколько встреч восстановлено расчётом, а не прочитано из таблицы — их надо проверить руками. */
  guessedCount: number;
};

export async function getGroupStage(division: string): Promise<GroupTable[]> {
  const [entries, series] = await Promise.all([
    prisma.groupEntry.findMany({
      where: { division },
      include: { team: { select: { id: true, name: true, tag: true, logo: true } } },
      orderBy: [{ group: "asc" }, { place: "asc" }],
    }),
    prisma.groupSeries.findMany({ where: { division } }),
  ]);

  const byGroup = new Map<string, typeof entries>();
  for (const e of entries) {
    if (!byGroup.has(e.group)) byGroup.set(e.group, []);
    byGroup.get(e.group)!.push(e);
  }

  return [...byGroup.entries()].map(([group, list]) => {
    const mine = series.filter((s) => s.group === group);

    const rows: GroupRow[] = list.map((e) => {
      const played = mine.filter((s) => s.homeId === e.teamId || s.awayId === e.teamId);
      let wins = 0;
      let points = 0;
      for (const s of played) {
        const home = s.homeId === e.teamId;
        const own = home ? s.homeScore : s.awayScore;
        const opp = home ? s.awayScore : s.homeScore;
        if (own > opp) wins++;
        points += seriesPoints(own, opp);
      }
      return {
        teamId: e.teamId,
        name: e.team.name,
        tag: e.team.tag,
        logo: e.team.logo,
        place: e.place,
        played: played.length,
        wins,
        losses: played.length - wins,
        points,
        sheet: { played: e.played, wins: e.wins, losses: e.losses, points: e.points },
      };
    });
    const grid = rows.map((r) =>
      rows.map<GroupCell>((c) => {
        if (r.teamId === c.teamId) return null; // диагональ — сам с собой не играет
        const direct = mine.find((s) => s.homeId === r.teamId && s.awayId === c.teamId);
        if (direct) {
          return { id: direct.id, score: `${direct.homeScore}:${direct.awayScore}`, guessed: direct.guessed, flipped: false };
        }
        // встреча записана с другой стороны — показываем зеркально
        const back = mine.find((s) => s.homeId === c.teamId && s.awayId === r.teamId);
        return back ? { id: back.id, score: `${back.awayScore}:${back.homeScore}`, guessed: back.guessed, flipped: true } : null;
      }),
    );

    return { division, group, rows, grid, guessedCount: mine.filter((s) => s.guessed).length };
  });
}
