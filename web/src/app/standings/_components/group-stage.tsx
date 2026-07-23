"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GroupTable } from "@/lib/group-stage";

// Групповая стадия — отыгранный этап перед плей-офф, поэтому подан отдельным блоком-постером,
// а не ещё одной строкой в таблице лиги.

const OUTCOMES = ["2:0", "2:1", "1:2", "0:2"];

/** Короткая подпись команды для шапки сетки: тег, если он есть, иначе обрезанное название. */
const shortName = (tag: string | null, name: string) => tag ?? (name.length > 6 ? `${name.slice(0, 5)}…` : name);

export function GroupStage({ tables }: { tables: GroupTable[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(id: number, score: string, flipped: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/standings/series/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ score, flipped }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Не удалось сохранить");
    }
    router.refresh();
  }

  const totalGuessed = tables.reduce((s, t) => s + t.guessedCount, 0);
  // расхождение с таблицей сезона: считаем по каждой строке, а не по группе — так видно, кого проверять
  const drifted = tables.flatMap((t) =>
    t.rows.filter((r) => r.wins !== r.sheet.wins || r.losses !== r.sheet.losses || r.points !== r.sheet.points),
  );

  return (
    <section className="space-y-4">
      {totalGuessed > 0 && (
        <p className="text-xs text-amber-400">
          {totalGuessed} встреч(и) под вопросом — в таблице сезона сетка не подписана, пары восстановлены расчётом
        </p>
      )}
      {drifted.length > 0 && (
        <p className="text-xs text-rose-400">
          Расходится с таблицей сезона: {drifted.map((r) => r.name).join(", ")} — сверьте сетку
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {tables.map((t) => (
          <div key={t.group} className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/40">
            <div className="border-b border-neutral-800 bg-gradient-to-r from-violet-600/20 to-transparent px-4 py-2">
              <span className="text-sm font-bold tracking-wide text-neutral-100">Группа {t.group}</span>
              <span className="ml-2 text-xs text-neutral-500">{t.rows.length} команд</span>
            </div>

            <div className="overflow-x-auto p-3">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-neutral-500">
                    <th className="w-6 py-1 text-left text-xs font-medium">#</th>
                    <th className="py-1 text-left text-xs font-medium">Команда</th>
                    {t.rows.map((r) => (
                      <th key={r.teamId} className="w-10 py-1 text-center text-[10px] font-medium" title={r.name}>
                        {shortName(r.tag, r.name)}
                      </th>
                    ))}
                    <th className="w-8 py-1 text-center text-xs font-medium">В</th>
                    <th className="w-8 py-1 text-center text-xs font-medium">П</th>
                    <th className="w-10 py-1 text-center text-xs font-medium">О</th>
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((r, i) => (
                    <tr key={r.teamId} className="border-t border-neutral-900">
                      <td className="py-1 text-xs text-neutral-500">{r.place}</td>
                      <td className="max-w-32 truncate py-1 font-medium" title={r.name}>
                        {r.name}
                      </td>
                      {t.grid[i].map((cell, j) => (
                        <td key={t.rows[j].teamId} className="p-0.5 text-center">
                          {cell === null ? (
                            <span className="block rounded bg-neutral-900 py-1 text-neutral-700">·</span>
                          ) : (
                            <select
                              disabled={busy}
                              value={cell.score}
                              onChange={(e) => void save(cell.id, e.target.value, cell.flipped)}
                              title={`${r.name} — ${t.rows[j].name}`}
                              className={`w-full cursor-pointer rounded border-0 px-0 py-1 text-center text-xs outline-none focus:ring-1 focus:ring-violet-500 ${
                                cell.guessed
                                  ? "bg-amber-500/15 text-amber-300"
                                  : cell.score.startsWith("2")
                                    ? "bg-transparent text-emerald-400"
                                    : "bg-transparent text-neutral-500"
                              }`}
                            >
                              {OUTCOMES.map((o) => (
                                <option key={o} value={o} className="bg-neutral-900">
                                  {o}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      ))}
                      {/* разошлось с таблицей сезона — рядом мелким исходное число */}
                      <td className="py-1 text-center text-emerald-400">
                        {r.wins}
                        {r.wins !== r.sheet.wins && <span className="ml-1 text-[10px] text-rose-400">({r.sheet.wins})</span>}
                      </td>
                      <td className="py-1 text-center text-neutral-500">{r.losses}</td>
                      <td className="py-1 text-center font-bold">
                        {r.points}
                        {r.points !== r.sheet.points && (
                          <span className="ml-1 text-[10px] font-normal text-rose-400">({r.sheet.points})</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      <p className="text-xs text-neutral-600">
        В/П/очки считаются из сетки; в скобках — исходное число из таблицы сезона, если разошлось.
        Очки за серию: 2:0 — 3, 2:1 — 2, 1:2 — 1, 0:2 — 0.
      </p>
    </section>
  );
}
