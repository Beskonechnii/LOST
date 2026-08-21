import Link from "next/link";
import { notFound } from "next/navigation";
import { divisionTeams, tournamentBySlug, TOURNAMENT_STATUS_LABELS, type TournamentStatus } from "@/lib/tournaments";
import { teamTag } from "@/lib/profiles";
import { SITE_MAX_W } from "../../../_components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = await tournamentBySlug((await params).slug);
  return { title: t ? t.name : "Турнир" };
}

// Публичная карточка турнира: регламент как его написал организатор, дивизионы и участники.
// Таблицы и сетка живут в своих разделах (/standings/<div>) — здесь только вход в них.

const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric" });

export default async function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  if (!tournament || tournament.status === "draft") notFound();

  const rosters = await Promise.all(tournament.divisions.map((d) => divisionTeams(d.id)));
  const facts = [
    TOURNAMENT_STATUS_LABELS[tournament.status as TournamentStatus] ?? tournament.status,
    tournament.startAt && `старт ${date.format(tournament.startAt)}`,
    tournament.format,
    tournament.prize && `призовой ${tournament.prize}`,
  ].filter(Boolean);

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <Link href="/tournaments" className="text-xs text-ink-subtle hover:text-ink">
        ← Все турниры
      </Link>
      <h1 className="mt-2 text-2xl font-black tracking-tight">{tournament.name}</h1>
      <p className="mt-1.5 text-sm text-ink-subtle">{facts.join(" · ")}</p>

      {tournament.description && (
        <p className="mt-4 max-w-3xl whitespace-pre-line text-sm text-ink-muted">{tournament.description}</p>
      )}

      <section className="mt-8 space-y-4">
        {tournament.divisions.map((d, i) => (
          <div key={d.id} className="rounded-lg border border-hairline bg-surface-1 p-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="text-base font-black">{d.label ?? d.name}</h2>
              <span className="text-xs text-ink-subtle">{rosters[i].length} команд(ы)</span>
              <Link href={`/standings/${d.slug}`} className="ml-auto text-xs text-accent-bright hover:underline">
                Таблицы и сетка →
              </Link>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {rosters[i].map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/roster/teams/${e.team.id}`}
                    className="rounded-[12px] bg-surface-2 px-3 py-1.5 text-sm hover:text-accent-bright"
                  >
                    {e.team.name} <span className="text-xs text-ink-subtle">{teamTag(e.team)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  );
}
