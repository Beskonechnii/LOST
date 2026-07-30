import Link from "next/link";
import { notFound } from "next/navigation";
import { getStandings } from "@/lib/standings";
import { QUALIFICATION, qualificationOf } from "@/lib/qualification";
import { divisionBySlug } from "@/lib/divisions";

export const dynamic = "force-dynamic";

export default async function StandingsPage({ params }: { params: Promise<{ div: string }> }) {
  const { div } = await params;
  const division = divisionBySlug(div);
  if (!division) notFound();

  const groups = await getStandings(division.name);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Таблицы</h1>
        <p className="text-xs text-ink-subtle">
          Считается из{" "}
          <Link href={`/standings/${division.slug}/groups`} className="text-accent-bright hover:underline">
            групповой стадии
          </Link>
          , сыгранных матчей и реестра баллов
        </p>
      </div>

      {/* легенда: те же цвета, что и полоса слева от места в таблице */}
      <div className="flex flex-wrap gap-4 text-xs text-ink-muted">
        {(["upper", "lower", "out"] as const).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${QUALIFICATION[k].marker}`} />
            {QUALIFICATION[k].label}
          </span>
        ))}
      </div>

      {groups.length === 0 && <p className="text-ink-muted">Нет данных.</p>}

      <div className="grid gap-6 xl:grid-cols-2">
        {groups.map((g) => (
          <section key={g.group} className="overflow-hidden rounded-lg border border-hairline bg-surface-1/40">
            <div className="border-b border-hairline bg-gradient-to-r from-accent/20 to-transparent px-4 py-2">
              <span className="text-sm font-bold tracking-wide text-ink">Группа {g.group}</span>
              <span className="ml-2 text-xs text-ink-subtle">{g.rows.length} команд</span>
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-hairline text-ink-muted">
                  <th className="w-10 py-2 pl-3 text-left font-medium">#</th>
                  <th className="w-14 py-2 text-left font-medium">Тег</th>
                  <th className="py-2 text-left font-medium">Команда</th>
                  <th className="w-10 py-2 text-center font-medium">И</th>
                  <th className="w-10 py-2 text-center font-medium">В</th>
                  <th className="w-10 py-2 text-center font-medium">П</th>
                  <th className="w-14 py-2 pr-3 text-center font-medium">Очки</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, i) => {
                  const place = r.place ?? i + 1;
                  const zone = QUALIFICATION[qualificationOf(place, g.rows.length)];
                  return (
                    <tr key={r.teamId} className="border-b border-hairline last:border-0 hover:bg-surface-1/60">
                      <td className="py-2 pl-3">
                        <span className="flex items-center gap-2">
                          <span className={`h-4 w-1 rounded-sm ${zone.marker}`} title={zone.label} />
                          <span className="text-ink-subtle">{place}</span>
                        </span>
                      </td>
                      <td className="py-2 text-xs font-medium text-ink-subtle">{r.tag}</td>
                      <td className="py-2">
                        <Link href={`/roster/teams/${r.teamId}`} className={`font-medium hover:underline ${zone.text}`}>
                          {r.name}
                        </Link>
                      </td>
                      <td className="py-2 text-center text-ink-muted">{r.played}</td>
                      <td className="py-2 text-center text-ink-muted">{r.wins}</td>
                      <td className="py-2 text-center text-ink-subtle">{r.losses}</td>
                      <td className="py-2 pr-3 text-center font-bold">{r.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}
