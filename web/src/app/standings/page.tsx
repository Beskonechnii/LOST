import { getStandings } from "@/lib/standings";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const groups = await getStandings();

  return (
    <main className="flex-1 p-6 md:p-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">LOST — Таблица</h1>

        {groups.length === 0 && <p className="text-neutral-400">Нет данных.</p>}

        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.group}>
              <h2 className="mb-2 text-sm uppercase tracking-widest text-neutral-400">Группа {g.group}</h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-400">
                    <th className="w-8 py-2 pl-2 text-left font-medium">#</th>
                    <th className="py-2 text-left font-medium">Команда</th>
                    <th className="w-12 py-2 text-center font-medium">И</th>
                    <th className="w-12 py-2 text-center font-medium">В</th>
                    <th className="w-12 py-2 text-center font-medium">П</th>
                    <th className="w-16 py-2 pr-2 text-center font-medium">Очки</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r, i) => (
                    <tr key={r.teamId} className="border-b border-neutral-900">
                      <td className="py-2 pl-2 text-neutral-500">{i + 1}</td>
                      <td className="py-2 font-medium">
                        {r.tag && <span className="mr-2 text-neutral-500">{r.tag}</span>}
                        {r.name}
                      </td>
                      <td className="py-2 text-center text-neutral-300">{r.played}</td>
                      <td className="py-2 text-center text-emerald-400">{r.wins}</td>
                      <td className="py-2 text-center text-neutral-400">{r.losses}</td>
                      <td className="py-2 pr-2 text-center font-bold">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
