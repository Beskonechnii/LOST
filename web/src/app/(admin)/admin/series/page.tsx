import { prisma } from "@/lib/prisma";
import { teamTag } from "@/lib/profiles";
import { DIVISIONS } from "@/lib/divisions";
import { listSeries } from "@/lib/series";
import { SeriesAdmin } from "./_components/series-admin";

export const dynamic = "force-dynamic";

export const metadata = { title: "Архив серий" };

// Операторская: завести встречу и подвесить на неё карты. Отсюда стата попадает в рейтинги
// (/standings/<div>/stats) — других путей в архив нет, поэтому страница живёт в (admin).

export default async function SeriesAdminPage() {
  const [teams, series] = await Promise.all([
    prisma.team.findMany({ orderBy: [{ group: "asc" }, { name: "asc" }], select: { id: true, name: true, tag: true, group: true } }),
    listSeries(),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">
      <SeriesAdmin
        divisions={DIVISIONS.map((d) => ({ name: d.name, label: d.label }))}
        teams={teams.map((t) => ({ id: t.id, name: t.name, tag: teamTag(t), division: t.group }))}
        series={series}
      />
    </main>
  );
}
