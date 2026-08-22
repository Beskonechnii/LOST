import Link from "next/link";
import { notFound } from "next/navigation";
import {
  divisionTeams,
  registrationOpen,
  tournamentBySlug,
  TOURNAMENT_STATUS_LABELS,
  type TournamentStatus,
} from "@/lib/tournaments";
import { HubTiles, type HubTile } from "@/app/_components/hub-tiles";
import { SITE_MAX_W } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = await tournamentBySlug((await params).slug);
  return { title: t ? t.name : "Турнир" };
}

// Хаб турнира — то, чем раньше был хаб сезона на /standings, только не захардкоженный: плитки его
// дивизионов, ростер и TP, плюс статус и регламент. Любой заведённый турнир получает такую же
// структуру, что и S2, — в этом весь смысл переезда разделов под /tournaments/<slug>.

const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric" });

/** Цвет плашки статуса — тот же смысл, что в админке, но на витрине. */
const TONE: Record<TournamentStatus, string> = {
  draft: "bg-surface-2 text-ink-subtle",
  registration: "bg-sky-500/20 text-sky-300",
  running: "bg-emerald-500/20 text-emerald-300",
  finished: "bg-amber-500/20 text-amber-300",
};

const NUMERALS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"];

export default async function TournamentHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  if (!tournament || tournament.status === "draft") notFound();

  const rosters = await Promise.all(tournament.divisions.map((d) => divisionTeams(d.id)));
  const status = (tournament.status as TournamentStatus) ?? "draft";
  const teamsTotal = rosters.reduce((n, r) => n + r.length, 0);

  const tiles: HubTile[] = [
    ...tournament.divisions.map((d, i) => ({
      href: `/tournaments/${slug}/${d.slug}`,
      label: d.label ?? d.name,
      icon: NUMERALS[i] ?? "🏆",
      desc: `Таблицы групп, плей-офф и статистика. Команд: ${rosters[i].length}.`,
    })),
    { href: "/roster", label: "Ростер", icon: "👥", desc: "Команды и игроки лиги." },
    { href: "/tp", label: "TP", icon: "🏅", desc: "Зачёт очков MVP." },
  ];

  const facts = [
    tournament.startAt && `старт ${date.format(tournament.startAt)}`,
    tournament.endAt && `финиш ${date.format(tournament.endAt)}`,
    tournament.format,
    tournament.prize && `призовой ${tournament.prize}`,
    teamsTotal > 0 && `команд ${teamsTotal}`,
  ].filter(Boolean);

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <div className="mb-4 flex flex-wrap items-center gap-2 font-pouf">
        <span className={`rounded-[12px] px-3 py-1 text-xs font-black ${TONE[status]}`}>
          {TOURNAMENT_STATUS_LABELS[status] ?? tournament.status}
        </span>
        {registrationOpen(tournament) && (
          <Link
            href={`/tournaments/${slug}/apply`}
            className="rounded-[12px] bg-purple px-3 py-1 text-xs font-black text-[var(--on-accent)] cushion-control"
          >
            Подать заявку командой
          </Link>
        )}
      </div>

      <HubTiles
        eyebrow={facts.join(" · ") || "League of Spirits"}
        title={tournament.name}
        tiles={tiles}
        cols={4}
      />

      {tournament.description && (
        <section className="mt-8 max-w-3xl font-pouf">
          <h2 className="text-sm font-black uppercase tracking-[0.12em] text-ink-subtle">Регламент</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-ink-muted">{tournament.description}</p>
        </section>
      )}

    </main>
  );
}
