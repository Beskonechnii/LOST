import Link from "next/link";
import { QUALIFICATION, qualificationOf } from "@/lib/qualification";
import type { GroupTable } from "@/lib/group-stage";

// Групповая стадия: таблица группы + сетка личных встреч. Только чтение — счёт берётся из привязанных
// карт (архив серий), руками здесь не правится. Правки идут через /admin/series, оттуда и пересчёт.

export function GroupStage({ tables }: { tables: GroupTable[] }) {
  return (
    <div className="grid gap-6 2xl:grid-cols-2">
      {tables.map((t) => (
        <div
          key={t.group}
          className="overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_16px_44px_-26px_rgba(0,0,0,0.9)]"
        >
          <div className="border-b border-hairline bg-gradient-to-r from-accent/[0.14] to-transparent px-5 py-3">
            <span className="text-sm font-bold tracking-wide text-ink">Группа {t.group}</span>
            <span className="ml-2 text-xs text-ink-subtle">{t.rows.length} команд</span>
          </div>

          <div className="overflow-x-auto p-4">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-ink-subtle">
                  <th className="w-10 py-1.5 text-left text-xs font-medium">#</th>
                  <th className="py-1.5 text-left text-xs font-medium">Команда</th>
                  {/* заголовки колонок сетки — теги соперников */}
                  {t.rows.map((r) => (
                    <th key={r.teamId} className="w-9 py-1.5 text-center text-[10px] font-medium" title={r.name}>
                      {r.tag}
                    </th>
                  ))}
                  <th className="w-9 py-1.5 text-center text-xs font-medium">И</th>
                  <th className="w-9 py-1.5 text-center text-xs font-medium">В</th>
                  <th className="w-9 py-1.5 text-center text-xs font-medium">П</th>
                  <th className="w-10 py-1.5 text-center text-xs font-medium">О</th>
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r, i) => {
                  const zone = QUALIFICATION[qualificationOf(r.place, t.rows.length)];
                  const leader = r.place === 1;
                  return (
                    <tr key={r.teamId} className="border-t border-hairline">
                      <td className="py-1.5">
                        <span className="flex items-center gap-1.5">
                          <span className={`h-3.5 w-1 rounded-sm ${zone.marker}`} title={zone.label} />
                          <span className={`text-xs tabular-nums ${leader ? "font-bold text-ink" : "text-ink-subtle"}`}>
                            {r.place}
                          </span>
                        </span>
                      </td>
                      <td className="max-w-40 truncate py-1.5" title={r.name}>
                        <Link href={`/roster/teams/${r.teamId}`} className={`font-medium hover:underline ${zone.text}`}>
                          {r.name}
                        </Link>
                      </td>
                      {t.grid[i].map((cell, j) => (
                        <td key={t.rows[j].teamId} className="p-0.5 text-center">
                          {cell === null ? (
                            // диагональ — сам с собой не играет
                            <span className="block py-1 text-ink-subtle/40">·</span>
                          ) : (
                            <span
                              title={`${r.name} — ${t.rows[j].name}`}
                              className={`block py-1 text-xs tabular-nums ${
                                cell.score.startsWith("2") ? "text-emerald-400" : "text-ink-subtle"
                              }`}
                            >
                              {cell.score}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="py-1.5 text-center text-xs tabular-nums text-ink-muted">{r.played}</td>
                      <td className="py-1.5 text-center font-medium tabular-nums text-emerald-400/90">{r.wins}</td>
                      <td className="py-1.5 text-center tabular-nums text-ink-subtle">{r.losses}</td>
                      <td className="py-1.5 text-center font-bold tabular-nums text-ink">{r.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
