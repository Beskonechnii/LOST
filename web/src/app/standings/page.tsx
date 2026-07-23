import Link from "next/link";
import { getStandings } from "@/lib/standings";
import { QUALIFICATION, qualificationOf } from "@/lib/qualification";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const groups = await getStandings();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Таблицы</h1>
        <p className="text-xs text-neutral-500">
          Считается из{" "}
          <Link href="/standings/groups" className="text-violet-400 hover:underline">
            групповой стадии
          </Link>
          , сыгранных матчей и реестра баллов
        </p>
      </div>

      {/* легенда: те же цвета, что и полоса слева от места в таблице */}
      <div className="flex flex-wrap gap-4 text-xs text-neutral-400">
        {(["upper", "lower", "out"] as const).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${QUALIFICATION[k].marker}`} />
            {QUALIFICATION[k].label}
          </span>
        ))}
      </div>

      {groups.length === 0 && <p className="text-neutral-400">Нет данных.</p>}

      <div className="grid gap-6 xl:grid-cols-2">
        {groups.map((g) => (
          <section key={g.group} className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/40">
            <div className="border-b border-neutral-800 bg-gradient-to-r from-violet-600/20 to-transparent px-4 py-2">
              <span className="text-sm font-bold tracking-wide text-neutral-100">Группа {g.group}</span>
              <span className="ml-2 text-xs text-neutral-500">{g.rows.length} команд</span>
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400">
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
                    <tr key={r.teamId} className="border-b border-neutral-900 last:border-0 hover:bg-neutral-900/60">
                      <td className="py-2 pl-3">
                        <span className="flex items-center gap-2">
                          <span className={`h-4 w-1 rounded-sm ${zone.marker}`} title={zone.label} />
                          <span className="text-neutral-500">{place}</span>
                        </span>
                      </td>
                      <td className="py-2 text-xs font-medium text-neutral-500">{r.tag}</td>
                      <td className="py-2">
                        <Link href={`/roster/teams/${r.teamId}`} className={`font-medium hover:underline ${zone.text}`}>
                          {r.name}
                        </Link>
                      </td>
                      <td className="py-2 text-center text-neutral-300">{r.played}</td>
                      <td className="py-2 text-center text-neutral-300">{r.wins}</td>
                      <td className="py-2 text-center text-neutral-500">{r.losses}</td>
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
