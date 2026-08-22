import { prisma } from "@/lib/prisma";
import { teamTag } from "@/lib/profiles";
import { currentTournament, getDivisions } from "@/lib/tournaments";
import { listSeries } from "@/lib/series";
import { resolveBracket } from "@/lib/playoff";
import { SITE_MAX_W } from "@/app/_components/ui";
import { SeriesAdmin, type SlotOptions } from "./_components/series-admin";
import { denyUnlessPermission } from "../../_components/permission-gate";

export const dynamic = "force-dynamic";

export const metadata = { title: "Архив серий" };

// Операторская: завести встречу и подвесить на неё карты. Отсюда стата попадает в рейтинги
// (раздел «Статистика» дивизиона) — других путей в архив нет, поэтому страница живёт в (admin).

export default async function SeriesAdminPage() {
  const denied = await denyUnlessPermission("series.edit", "Архив серий");
  if (denied) return denied;

  const [current, divisions] = await Promise.all([currentTournament(), getDivisions()]);
  const [teams, series, ...brackets] = await Promise.all([
    // Команды берём через участие в турнире: дивизион команды — это строка `TournamentEntry`,
    // а не поле у неё (см. src/lib/tournaments.ts).
    prisma.tournamentEntry.findMany({
      where: { divisionId: { in: divisions.map((d) => d.id) } },
      include: { team: { select: { id: true, name: true, tag: true } } },
      orderBy: { team: { name: "asc" } },
    }),
    listSeries(),
    ...divisions.map((d) => resolveBracket(d.id)),
  ]);

  // Слоты сетки для формы: с уже подставленными командами (когда исход известен) и пометкой
  // «занят». Форма выбирает дивизион на клиенте, поэтому шлём слоты обоих дивизионов разом.
  const slots: SlotOptions = {};
  divisions.forEach((d, i) => {
    slots[d.id] = brackets[i].slots.map((s) => ({
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
        divisions={divisions.map((d) => ({ id: d.id, name: d.name, label: d.label }))}
        statsHref={current && divisions[0] ? `/tournaments/${current.slug}/${divisions[0].slug}/stats` : "/tournaments"}
        teams={teams.map((e) => ({ id: e.team.id, name: e.team.name, tag: teamTag(e.team), divisionId: e.divisionId }))}
        series={series}
        slots={slots}
      />
    </main>
  );
}
