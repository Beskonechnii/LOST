import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { teamTag } from "@/lib/profiles";
import { tournamentBySlug } from "@/lib/tournaments";
import { listSeries } from "@/lib/series";
import { resolveBracket } from "@/lib/playoff";
import { SITE_MAX_W } from "@/app/_components/ui";
import { SeriesAdmin, type SlotOptions } from "../_components/series-admin";
import { denyUnlessPermission } from "../../../_components/permission-gate";
import { saveMatchesUrl } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = await tournamentBySlug((await params).slug);
  return { title: t ? `Архив · ${t.short ?? t.name}` : "Архив серий" };
}

// Техническая часть архива — внутри турнира: заведение встречи, привязка/отцепка карт,
// перечитывание статы. Наверху (/admin/series) остались только блоки турниров: оператор работает
// с одним сезоном за раз и не должен видеть чужие.

export default async function TournamentSeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const denied = await denyUnlessPermission("series.edit", "Архив серий");
  if (denied) return denied;

  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  if (!tournament) notFound();

  const divisions = tournament.divisions;
  const [teams, series, ...brackets] = await Promise.all([
    // Команды берём через участие в турнире: дивизион команды — это строка `TournamentEntry`,
    // а не поле у неё (см. src/lib/tournaments.ts).
    prisma.tournamentEntry.findMany({
      where: { divisionId: { in: divisions.map((d) => d.id) } },
      include: { team: { select: { id: true, name: true, tag: true } } },
      orderBy: { team: { name: "asc" } },
    }),
    listSeries({ divisionIds: divisions.map((d) => d.id) }),
    ...divisions.map((d) => resolveBracket(d.id)),
  ]);

  // Слоты сетки для формы: с уже подставленными командами (когда исход известен) и пометкой
  // «занят». Форма выбирает дивизион на клиенте, поэтому шлём слоты всех дивизионов разом.
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
      <Link href="/admin/series" className="text-sm font-bold text-ink-muted hover:text-accent-bright">
        ← Все турниры
      </Link>

      {/* Источник id матчей — у турнира, не у встречи: список матчей общий на сезон, и оператор
          ходит за номерами карт по одной и той же ссылке (Liquipedia, Dotabuff — что найдётся). */}
      <form action={saveMatchesUrl} className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-hairline bg-surface-1 p-3">
        <input type="hidden" name="slug" value={tournament.slug} />
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="matchesUrl" className="block text-xs text-ink-subtle">
            Источник id матчей турнира
          </label>
          <input
            id="matchesUrl"
            name="matchesUrl"
            defaultValue={tournament.matchesUrl ?? ""}
            placeholder="https://liquipedia.net/dota2/… или ссылка на Dotabuff"
            className="mt-1 w-full rounded-md border border-hairline bg-surface-2 px-3 py-1.5 text-sm text-ink"
          />
        </div>
        <button type="submit" className="rounded-md bg-purple px-3 py-1.5 text-sm font-semibold text-[var(--on-accent)]">
          Сохранить
        </button>
        {tournament.matchesUrl && (
          <a
            href={tournament.matchesUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-hairline px-3 py-1.5 text-sm font-semibold text-accent-bright"
          >
            Открыть →
          </a>
        )}
      </form>

      <div className="mt-4">
        <SeriesAdmin
          divisions={divisions.map((d) => ({ id: d.id, name: d.name, label: d.label ?? d.name }))}
          statsHref={divisions[0] ? `/tournaments/${tournament.slug}/${divisions[0].slug}/stats` : "/tournaments"}
          teams={teams.map((e) => ({ id: e.team.id, name: e.team.name, tag: teamTag(e.team), divisionId: e.divisionId }))}
          series={series}
          slots={slots}
          tournamentName={tournament.short ?? tournament.name}
        />
      </div>
    </main>
  );
}
