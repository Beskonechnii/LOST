import Link from "next/link";
import { getStandings } from "@/lib/standings";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const groups = await getStandings();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">LOST div1</h1>
        <p className="text-xs text-neutral-500">
          Считается из{" "}
          <Link href="/standings/groups" className="text-violet-400 hover:underline">
            групповой стадии
          </Link>
          , сыгранных матчей и реестра баллов
        </p>
      </div>

      {groups.length === 0 && <p className="text-neutral-400">Нет данных.</p>}

      {groups.map((g) => (
        <table key={g.group} className="w-full max-w-3xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-400">
              <th className="w-8 py-2 pl-2 text-left font-medium">#</th>
              <th className="py-2 text-left font-medium">Команда</th>
              <th className="w-16 py-2 text-center font-medium">Группа</th>
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
                <td className="py-2 text-center text-xs text-neutral-500">{r.stageGroup ?? "—"}</td>
                <td className="py-2 text-center text-neutral-300">{r.played}</td>
                <td className="py-2 text-center text-emerald-400">{r.wins}</td>
                <td className="py-2 text-center text-neutral-400">{r.losses}</td>
                <td className="py-2 pr-2 text-center font-bold">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}
