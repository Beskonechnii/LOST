"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QUALIFICATION, qualificationOf } from "@/lib/qualification";
import type { GroupTable } from "@/lib/group-stage";

// Групповая стадия — отыгранный этап перед плей-офф, поэтому подан отдельным блоком-постером,
// а не ещё одной строкой в таблице лиги.

const OUTCOMES = ["2:0", "2:1", "1:2", "0:2"];

export function GroupStage({ tables }: { tables: GroupTable[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(id: number, score: string, flipped: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/series/${id}`, {
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

  // расхождение с таблицей сезона: считаем по каждой строке, а не по группе — так видно, кого проверять
  const drifted = tables.flatMap((t) =>
    t.rows.filter((r) => r.wins !== r.sheet.wins || r.losses !== r.sheet.losses || r.points !== r.sheet.points),
  );

  return (
    <section className="space-y-4">
      {drifted.length > 0 && (
        <p className="text-xs text-rose-400">
          Расходится с таблицей сезона: {drifted.map((r) => r.name).join(", ")} — сверьте сетку
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {tables.map((t) => (
          <div
            key={t.group}
            className="overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_16px_44px_-26px_rgba(0,0,0,0.9)]"
          >
            <div className="border-b border-hairline bg-gradient-to-r from-accent/[0.14] to-transparent px-4 py-2.5">
              <span className="text-sm font-bold tracking-wide text-ink">Группа {t.group}</span>
              <span className="ml-2 text-xs text-ink-subtle">{t.rows.length} команд</span>
            </div>

            <div className="overflow-x-auto p-3">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-ink-subtle">
                    <th className="w-10 py-1 text-left text-xs font-medium">#</th>
                    <th className="py-1 text-left text-xs font-medium">Команда</th>
                    {t.rows.map((r) => (
                      <th key={r.teamId} className="w-10 py-1 text-center text-[10px] font-medium" title={r.name}>
                        {r.tag}
                      </th>
                    ))}
                    <th className="w-8 py-1 text-center text-xs font-medium">В</th>
                    <th className="w-8 py-1 text-center text-xs font-medium">П</th>
                    <th className="w-10 py-1 text-center text-xs font-medium">О</th>
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((r, i) => {
                    const zone = QUALIFICATION[qualificationOf(r.place, t.rows.length)];
                    return (
                    <tr key={r.teamId} className="border-t border-hairline">
                      <td className="py-1">
                        <span className="flex items-center gap-1.5">
                          <span className={`h-3.5 w-1 rounded-sm ${zone.marker}`} title={zone.label} />
                          <span className="text-xs text-ink-subtle">{r.place}</span>
                        </span>
                      </td>
                      <td className="max-w-32 truncate py-1" title={r.name}>
                        <Link href={`/roster/teams/${r.teamId}`} className={`font-medium hover:underline ${zone.text}`}>
                          {r.name}
                        </Link>
                      </td>
                      {t.grid[i].map((cell, j) => (
                        <td key={t.rows[j].teamId} className="p-0.5 text-center">
                          {cell === null ? (
                            <span className="block rounded bg-surface-1 py-1 text-ink-subtle">·</span>
                          ) : (
                            <select
                              disabled={busy}
                              value={cell.score}
                              onChange={(e) => void save(cell.id, e.target.value, cell.flipped)}
                              title={`${r.name} — ${t.rows[j].name}`}
                              className={`w-full cursor-pointer rounded border-0 bg-transparent px-0 py-1 text-center text-xs outline-none focus:ring-1 focus:ring-accent-bright ${
                                cell.score.startsWith("2") ? "text-emerald-400" : "text-ink-subtle"
                              }`}
                            >
                              {OUTCOMES.map((o) => (
                                <option key={o} value={o} className="bg-surface-1">
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
                      <td className="py-1 text-center text-ink-subtle">{r.losses}</td>
                      <td className="py-1 text-center font-bold">
                        {r.points}
                        {r.points !== r.sheet.points && (
                          <span className="ml-1 text-[10px] font-normal text-rose-400">({r.sheet.points})</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      <p className="text-xs text-ink-subtle">
        В/П/очки считаются из сетки; в скобках — исходное число из таблицы сезона, если разошлось.
        Очки за серию: 2:0 — 3, 2:1 — 2, 1:2 — 1, 0:2 — 0.
      </p>
    </section>
  );
}
