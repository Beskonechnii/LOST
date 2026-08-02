import { prisma } from "@/lib/prisma";
import { teamTag } from "@/lib/profiles";
import { DIVISIONS } from "@/lib/divisions";
import { listSeries } from "@/lib/series";
import { resolveBracket } from "@/lib/playoff";
import { SITE_MAX_W } from "@/app/_components/ui";
import { SeriesAdmin, type SlotOptions } from "./_components/series-admin";

export const dynamic = "force-dynamic";

export const metadata = { title: "Архив серий" };

// Операторская: завести встречу и подвесить на неё карты. Отсюда стата попадает в рейтинги
// (/standings/<div>/stats) — других путей в архив нет, поэтому страница живёт в (admin).

export default async function SeriesAdminPage() {
  const [teams, series, ...brackets] = await Promise.all([
    prisma.team.findMany({ orderBy: [{ group: "asc" }, { name: "asc" }], select: { id: true, name: true, tag: true, group: true } }),
    listSeries(),
    ...DIVISIONS.map((d) => resolveBracket(d.name)),
  ]);

  // Слоты сетки для формы: с уже подставленными командами (когда исход известен) и пометкой
  // «занят». Форма выбирает дивизион на клиенте, поэтому шлём слоты обоих дивизионов разом.
  const slots: SlotOptions = {};
  DIVISIONS.forEach((d, i) => {
    slots[d.name] = brackets[i].slots.map((s) => ({
      key: s.key,
      label: s.label,
      round: s.round,
      bestOf: s.bestOf,
      aTeamId: s.a.team?.teamId ?? null,
      bTeamId: s.b.team?.teamId ?? null,
      aName: s.a.team?.name ?? s.a.placeholder ?? "—",
      bName: s.b.team?.name ?? s.b.placeholder ?? "—",
      taken: s.seriesSlug != null,
    }));
  });

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <SeriesAdmin
        divisions={DIVISIONS.map((d) => ({ name: d.name, label: d.label }))}
        teams={teams.map((t) => ({ id: t.id, name: t.name, tag: teamTag(t), division: t.group }))}
        series={series}
        slots={slots}
      />
    </main>
  );
}
