import Link from "next/link";
import { notFound } from "next/navigation";
import { divisionBySlug } from "@/lib/divisions";
import { getLeaders, METRICS, type Subject } from "@/lib/leaders";
import { BRACKETS, isBracket, isStage, STAGES } from "@/lib/stages";
import { SectionHeader } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

// Рейтинги турнира: одни и те же суммы, разрезанные стадией и группой. Фильтры живут в query,
// поэтому любой разрез — это ссылка, которую можно кинуть в чат (как и у постгейма).

type Query = { stage?: string; group?: string; bracket?: string; kind?: string };

const nf = new Intl.NumberFormat("ru-RU");
const fmt = (v: number, decimals = 0) =>
  decimals ? v.toLocaleString("ru-RU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : nf.format(Math.round(v));

/** Ссылка-фильтр: тот же адрес с подменённым параметром. `null` — параметр убрать (значение «все»). */
function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-gradient-to-b from-accent-bright to-accent text-white shadow-[0_5px_14px_-6px_var(--color-accent)]"
          : "border border-hairline bg-surface-1 text-ink-muted hover:border-accent/60 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function Board({
  title,
  hint,
  rows,
  decimals,
  perLabel,
}: {
  title: string;
  hint: string;
  rows: { subject: Subject; value: number; per: number | null }[];
  decimals: number;
  perLabel?: string;
}) {
  const top = rows[0]?.value ?? 0;
  return (
    <section className="overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_14px_40px_-26px_rgba(0,0,0,0.9)]">
      <div className="border-b border-hairline bg-gradient-to-r from-accent/[0.14] to-transparent px-4 py-2.5">
        <div className="text-sm font-bold tracking-wide text-ink">{title}</div>
        <div className="text-[11px] text-ink-subtle">{hint}</div>
      </div>
      {rows.length === 0 ?
        <p className="px-4 py-4 text-xs text-ink-subtle">Нет карт в этом разрезе.</p>
      : <ol className="divide-y divide-hairline">
          {rows.map((r, i) => {
            const leader = i === 0;
            return (
              <li
                key={`${r.subject.kind}-${r.subject.id}`}
                className="group relative flex items-center gap-2.5 px-4 py-2"
              >
                {/* полоса-доля от лидера: строку читаешь глазами, не сравнивая цифры */}
                <span
                  className={`absolute inset-y-0 left-0 ${leader ? "bg-accent/[0.16]" : "bg-accent/[0.08]"}`}
                  style={{ width: `${top > 0 ? Math.max(2, (r.value / top) * 100) : 0}%` }}
                  aria-hidden
                />
                <span
                  className={`relative grid h-5 w-5 shrink-0 place-items-center rounded-md text-[11px] font-bold tabular-nums ${
                    leader ? "bg-accent/20 text-accent-bright" : "text-ink-subtle"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="relative w-9 shrink-0 truncate text-[10px] font-medium text-ink-subtle">
                  {r.subject.tag}
                </span>
                <Link
                  href={r.subject.kind === "team" ? `/roster/teams/${r.subject.id}` : `/roster/players/${r.subject.id}`}
                  className="relative truncate text-sm font-semibold transition-colors group-hover:text-accent-bright"
                >
                  {r.subject.name}
                </Link>
                <span className="relative ml-auto shrink-0 text-right">
                  <span className="block text-sm font-bold tabular-nums text-ink">{fmt(r.value, decimals)}</span>
                  {r.per != null && perLabel && (
                    <span className="block text-[10px] tabular-nums text-ink-subtle">
                      {/* дробная часть осмысленна у «убийств за карту», а у «урона за карту» — шум */}
                      {fmt(r.per, r.per < 100 ? 1 : 0)} {perLabel}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      }
    </section>
  );
}

export default async function StatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ div: string }>;
  searchParams: Promise<Query>;
}) {
  const { div } = await params;
  const q = await searchParams;
  const division = divisionBySlug(div);
  if (!division) notFound();

  const stage = isStage(q.stage) ? q.stage : undefined;
  // Группа осмысленна только в группе, половина сетки — только в плей-офф: разрез в другой стадии
  // не сужал бы выборку, а обнулял её.
  const group = stage === "group" ? q.group || undefined : undefined;
  const bracket = stage === "playoff" && isBracket(q.bracket) ? q.bracket : undefined;
  const kind = q.kind === "teams" ? "teams" : "players";

  const data = await getLeaders({ division: division.name, stage, group, bracket });
  const subjects = kind === "teams" ? data.teams : data.players;

  const base = `/standings/${division.slug}/stats`;
  const link = (patch: Query) => {
    const next = new URLSearchParams();
    const merged = { stage: q.stage, group: q.group, bracket: q.bracket, kind: q.kind, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `${base}?${s}` : base;
  };


  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`${division.label} · рейтинги`}
        title="Статистика"
        aside={
          <>
            Карт в разрезе: <span className="text-ink-muted">{data.games}</span>
            {data.games > 0 && data.parsedGames < data.games && (
              <span className="text-amber-400"> · распарсено {data.parsedGames}</span>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] uppercase tracking-widest text-ink-subtle">Кто</span>
          <Chip href={link({ kind: undefined })} active={kind === "players"}>
            Игроки
          </Chip>
          <Chip href={link({ kind: "teams" })} active={kind === "teams"}>
            Команды
          </Chip>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] uppercase tracking-widest text-ink-subtle">Стадия</span>
          <Chip href={link({ stage: undefined, group: undefined, bracket: undefined })} active={!stage}>
            Весь турнир
          </Chip>
          {STAGES.map((s) => (
            <Chip key={s.key} href={link({ stage: s.key, group: undefined, bracket: undefined })} active={stage === s.key}>
              {s.label}
            </Chip>
          ))}
        </div>

        {stage === "group" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-widest text-ink-subtle">Группа</span>
            <Chip href={link({ group: undefined })} active={!group}>
              Обе
            </Chip>
            {["A", "B"].map((g) => (
              <Chip key={g} href={link({ group: g })} active={group === g}>
                {g}
              </Chip>
            ))}
          </div>
        )}

        {stage === "playoff" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-widest text-ink-subtle">Сетка</span>
            <Chip href={link({ bracket: undefined })} active={!bracket}>
              Вся
            </Chip>
            {BRACKETS.map((b) => (
              <Chip key={b.key} href={link({ bracket: b.key })} active={bracket === b.key}>
                {b.short}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {data.games === 0 ?
        <p className="rounded-lg border border-dashed border-hairline p-6 text-sm text-ink-muted">
          В этом разрезе нет ни одной карты. Карты попадают сюда, когда их привязывают к встрече —{" "}
          <Link href="/admin/series" className="text-accent-bright hover:underline">
            архив серий
          </Link>
          .
        </p>
      : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {METRICS.map((m) => {
            const rows = subjects
              .map((s) => ({ subject: s, value: m.value(s.totals), per: m.per ? m.per(s.totals) : null }))
              // Винрейт без карт — не ноль, а «нет данных»; такие субъекты в рейтинг не берём.
              .filter((r) => r.subject.totals.games > 0)
              .sort((a, b) => b.value - a.value || b.subject.totals.games - a.subject.totals.games)
              .slice(0, 10);
            return (
              <Board key={m.key} title={m.label} hint={m.hint} rows={rows} decimals={m.decimals ?? 0} perLabel={m.perLabel} />
            );
          })}
        </div>
      }
    </div>
  );
}
