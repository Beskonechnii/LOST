import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeam, teamMmr } from "@/lib/roster-data";
import { roleLabel } from "@/lib/roles";
import { TeamEditor } from "../../editors";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await getTeam(Number(id));
  if (!team) notFound();

  const mmr = teamMmr(team.players);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
          <Link href="/roster/teams" className="hover:text-neutral-300">
            Команды
          </Link>
          <span className="text-neutral-700">/</span>
          <span className="text-neutral-400">{team.name}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{team.name}</h1>
        <p className="text-xs text-neutral-600">slug: {team.slug} — ключ импорта составов и подбора файлов</p>
      </div>

      <TeamEditor
        id={team.id}
        initial={{
          name: team.name,
          tag: team.tag ?? "",
          group: team.group ?? "",
          color: team.color ?? "",
          logo: team.logo,
          wordmark: team.wordmark,
          photo: team.photo,
        }}
      />

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm uppercase tracking-widest text-neutral-500">Состав</h2>
          {mmr.average !== null && (
            <span className="text-xs text-neutral-400">
              MMR основы: ср. <span className="font-medium text-neutral-200">{mmr.average.toLocaleString("ru")}</span>
              {" · сумма "}
              <span className="font-medium text-neutral-200">{mmr.total.toLocaleString("ru")}</span>
              <span className="text-neutral-600"> (по {mmr.counted} из 5)</span>
            </span>
          )}
        </div>
        {team.players.length === 0 && <p className="text-sm text-neutral-500">Игроков нет — добавьте на странице «Игроки».</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {team.players.map((p) => (
            <Link
              key={p.id}
              href={`/roster/players/${p.id}`}
              className="flex items-center gap-3 rounded border border-neutral-800 bg-neutral-900/40 p-2 hover:border-violet-600"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded bg-neutral-900">
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] text-neutral-600">—</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {p.nickname}
                  {p.isCaptain && <span className="ml-2 text-xs text-violet-400">(C)</span>}
                </div>
                <div className="text-xs text-neutral-500">
                  {[roleLabel(p.role) ?? "роль не задана", p.mmr ? `${p.mmr.toLocaleString("ru")} MMR` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
