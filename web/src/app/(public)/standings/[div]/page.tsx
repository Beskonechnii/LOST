import Link from "next/link";
import { notFound } from "next/navigation";
import { getStandings } from "@/lib/standings";
import { QUALIFICATION, qualificationOf } from "@/lib/qualification";
import { divisionBySlug } from "@/lib/divisions";
import { Chip, Eyebrow, SectionHeader } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

export default async function StandingsPage({ params }: { params: Promise<{ div: string }> }) {
  const { div } = await params;
  const division = divisionBySlug(div);
  if (!division) notFound();

  const groups = await getStandings(division.name);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`${division.label} · таблицы`}
        title="Таблицы"
        aside={
          <>
            Считается из{" "}
            <Link href={`/standings/${division.slug}/groups`} className="text-accent-bright hover:underline">
              групповой стадии
            </Link>{" "}
            и реестра баллов
          </>
        }
      />

      {/* легенда: те же цвета, что и рейка слева от места в таблице */}
      <div className="flex flex-wrap gap-2">
        {(["upper", "lower", "out"] as const).map((k) => (
          <Chip key={k}>
            <span className={`h-2 w-2 rounded-full ${QUALIFICATION[k].marker}`} />
            {QUALIFICATION[k].label}
          </Chip>
        ))}
      </div>

      {groups.length === 0 && <p className="text-ink-muted">Нет данных.</p>}

      <div className="grid gap-5 xl:grid-cols-2">
        {groups.map((g) => (
          <section
            key={g.group}
            className="overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_16px_44px_-26px_rgba(0,0,0,0.9)]"
          >
            {/* шапка группы: акцент дивизиона тонкой заливкой слева */}
            <div className="flex items-center justify-between border-b border-hairline bg-gradient-to-r from-accent/[0.14] to-transparent px-4 py-3">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold tracking-wide text-ink">Группа {g.group}</span>
                <span className="text-xs text-ink-subtle">{g.rows.length} команд</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.08em] text-ink-subtle">
                    <th className="w-12 py-2.5 pl-4 text-left font-semibold">#</th>
                    <th className="py-2.5 text-left font-semibold">Команда</th>
                    <th className="w-11 py-2.5 text-center font-semibold">И</th>
                    <th className="w-11 py-2.5 text-center font-semibold">В</th>
                    <th className="w-11 py-2.5 text-center font-semibold">П</th>
                    <th className="w-16 py-2.5 pr-4 text-right font-semibold">Очки</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r, i) => {
                    const place = r.place ?? i + 1;
                    const zone = QUALIFICATION[qualificationOf(place, g.rows.length)];
                    const leader = place === 1;
                    return (
                      <tr
                        key={r.teamId}
                        className="group border-t border-hairline transition-colors hover:bg-[linear-gradient(90deg,rgba(124,58,237,0.07),transparent)]"
                      >
                        <td className="py-2.5 pl-4">
                          <span className="flex items-center gap-2.5">
                            <span className={`h-5 w-1 rounded-full ${zone.marker}`} title={zone.label} />
                            <span className={`tabular-nums ${leader ? "font-bold text-ink" : "text-ink-subtle"}`}>
                              {place}
                            </span>
                          </span>
                        </td>
                        <td className="py-2.5">
                          <Link
                            href={`/roster/teams/${r.teamId}`}
                            className="flex items-center gap-2 transition-colors group-hover:text-accent-bright"
                          >
                            <span className={`font-semibold ${zone.text}`}>{r.name}</span>
                            {r.tag && <span className="text-[11px] font-medium text-ink-subtle">{r.tag}</span>}
                          </Link>
                        </td>
                        <td className="py-2.5 text-center tabular-nums text-ink-muted">{r.played}</td>
                        <td className="py-2.5 text-center font-medium tabular-nums text-emerald-400/90">{r.wins}</td>
                        <td className="py-2.5 text-center tabular-nums text-ink-subtle">{r.losses}</td>
                        <td className="py-2.5 pr-4 text-right">
                          <span
                            className={`inline-block min-w-7 rounded-md px-1.5 py-0.5 text-right font-bold tabular-nums ${
                              leader ? "bg-accent/15 text-accent-bright" : "text-ink"
                            }`}
                          >
                            {r.points}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <Eyebrow className="text-ink-subtle/70">
        Правка результата встречи в архиве серий двигает и эту таблицу, и групповую стадию
      </Eyebrow>
    </div>
  );
}
