import Link from "next/link";
import { listTournaments, TOURNAMENT_STATUS_LABELS, type TournamentStatus } from "@/lib/tournaments";
import { SITE_MAX_W } from "../../_components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Турниры" };

// Публичный список турниров лиги. Черновики не показываем: турнир становится виден, когда его
// открыли на заявки — до этого он рабочая заготовка оператора, а не событие лиги.

const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric" });

export default async function TournamentsIndex() {
  const tournaments = (await listTournaments()).filter((t) => t.status !== "draft");

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">Лига</p>
      <h1 className="mt-1.5 text-2xl font-black tracking-tight">Турниры</h1>

      {tournaments.length === 0 ? (
        <p className="mt-6 text-sm text-ink-subtle">Пока ничего не объявлено.</p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {tournaments.map((t) => (
            <li key={t.id} className="rounded-lg border border-hairline bg-surface-1 p-4">
              <Link href={`/tournaments/${t.slug}`} className="text-base font-black hover:underline">
                {t.name}
              </Link>
              <p className="mt-1 text-xs text-ink-subtle">
                {TOURNAMENT_STATUS_LABELS[t.status as TournamentStatus] ?? t.status}
                {t.startAt && ` · с ${date.format(t.startAt)}`}
                {t.divisions.length > 0 && ` · ${t.divisions.map((d) => d.short ?? d.slug).join(", ")}`}
              </p>
              {t.description && <p className="mt-2 line-clamp-3 text-sm text-ink-muted">{t.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
