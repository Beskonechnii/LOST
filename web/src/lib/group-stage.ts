// Групповая стадия: снимок результатов из таблицы сезона (вкладка «GS») + сетка личных встреч.
// Живая таблица лиги считается отдельно — в standings.ts; здесь этап, который уже отыгран.

import { prisma } from "@/lib/prisma";
import { teamTag } from "@/lib/profiles";
import { qualificationOf, seriesPoints } from "@/lib/qualification";
import { resolveUpload } from "@/lib/uploads";

export type GroupRow = {
  teamId: number;
  name: string;
  /** Всегда заполнен: свой из ростера либо выведенный из названия (см. teamTag). */
  tag: string;
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

/** Кто куда вышел: команды по зонам, в порядке места в группе. Для сетки плей-офф. */
export async function getQualified(division: string) {
  const tables = await getGroupStage(division);
  const seeded = tables.flatMap((t) =>
    t.rows.map((r) => ({ ...r, group: t.group, zone: qualificationOf(r.place, t.rows.length) })),
  );
  const byPlace = (a: { place: number; group: string }, b: { place: number; group: string }) =>
    a.place - b.place || a.group.localeCompare(b.group);

  return {
    upper: seeded.filter((r) => r.zone === "upper").sort(byPlace),
    lower: seeded.filter((r) => r.zone === "lower").sort(byPlace),
    out: seeded.filter((r) => r.zone === "out").sort(byPlace),
  };
}

export async function getGroupStage(division: string): Promise<GroupTable[]> {
  const [entries, series] = await Promise.all([
    prisma.groupEntry.findMany({
      where: { division },
      include: { team: { select: { id: true, slug: true, name: true, tag: true, logo: true } } },
      orderBy: [{ group: "asc" }, { place: "asc" }],
    }),
    prisma.series.findMany({ where: { division, stage: "group" } }),
  ]);

  // Лого разрешаем разом до сборки таблиц: дальше идёт синхронный расчёт очков, асинхронность туда не тащим.
  const logoByTeam = new Map(
    await Promise.all(
      entries.map(async (e) => [e.teamId, await resolveUpload("teams", e.team.slug, "logo", e.team.logo)] as const),
    ),
  );

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
        tag: teamTag(e.team),
        logo: logoByTeam.get(e.teamId) ?? null,
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
