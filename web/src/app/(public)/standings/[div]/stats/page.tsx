import Link from "next/link";
import { notFound } from "next/navigation";
import { divisionBySlug } from "@/lib/divisions";
import { getLeaders, METRICS, type Subject } from "@/lib/leaders";
import { BRACKETS, isBracket, isStage, STAGES } from "@/lib/stages";

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
      className={`rounded-md px-2.5 py-1 text-xs transition ${
        active ? "bg-violet-600 font-medium text-white" : "border border-neutral-800 text-neutral-400 hover:border-violet-600 hover:text-neutral-200"
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
    <section className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/40">
      <div className="border-b border-neutral-800 bg-gradient-to-r from-violet-600/20 to-transparent px-3 py-2">
        <div className="text-sm font-bold tracking-wide text-neutral-100">{title}</div>
        <div className="text-[11px] text-neutral-500">{hint}</div>
      </div>
      {rows.length === 0 ?
        <p className="px-3 py-4 text-xs text-neutral-500">Нет карт в этом разрезе.</p>
      : <ol className="divide-y divide-neutral-900">
          {rows.map((r, i) => (
            <li key={`${r.subject.kind}-${r.subject.id}`} className="relative flex items-center gap-2 px-3 py-1.5">
              {/* полоса-доля от лидера: строку читаешь глазами, не сравнивая цифры */}
              <span
                className="absolute inset-y-0 left-0 bg-violet-600/10"
                style={{ width: `${top > 0 ? Math.max(2, (r.value / top) * 100) : 0}%` }}
                aria-hidden
              />
              <span className="relative w-4 shrink-0 text-right text-[11px] tabular-nums text-neutral-600">{i + 1}</span>
              <span className="relative w-9 shrink-0 truncate text-[10px] font-medium text-neutral-500">{r.subject.tag}</span>
              <Link
                href={r.subject.kind === "team" ? `/roster/teams/${r.subject.id}` : `/roster/players/${r.subject.id}`}
                className="relative truncate text-sm font-medium hover:text-violet-400 hover:underline"
              >
                {r.subject.name}
              </Link>
              <span className="relative ml-auto shrink-0 text-right">
                <span className="block text-sm font-bold tabular-nums">{fmt(r.value, decimals)}</span>
                {r.per != null && perLabel && (
                  <span className="block text-[10px] tabular-nums text-neutral-500">
                    {/* дробная часть осмысленна у «убийств за карту», а у «урона за карту» — шум */}
                    {fmt(r.per, r.per < 100 ? 1 : 0)} {perLabel}
                  </span>
                )}
              </span>
            </li>
          ))}
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
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Статистика</h1>
        <p className="text-xs text-neutral-500">
          Карт в разрезе: <span className="text-neutral-300">{data.games}</span>
          {data.games > 0 && data.parsedGames < data.games && (
            <span className="text-amber-400"> · распарсено {data.parsedGames} (варды и стаки только по ним)</span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] uppercase tracking-widest text-neutral-600">Кто</span>
          <Chip href={link({ kind: undefined })} active={kind === "players"}>
            Игроки
          </Chip>
          <Chip href={link({ kind: "teams" })} active={kind === "teams"}>
            Команды
          </Chip>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] uppercase tracking-widest text-neutral-600">Стадия</span>
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
            <span className="mr-1 text-[10px] uppercase tracking-widest text-neutral-600">Группа</span>
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
            <span className="mr-1 text-[10px] uppercase tracking-widest text-neutral-600">Сетка</span>
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
        <p className="rounded-lg border border-dashed border-neutral-800 p-6 text-sm text-neutral-400">
          В этом разрезе нет ни одной карты. Карты попадают сюда, когда их привязывают к встрече —{" "}
          <Link href="/admin/series" className="text-violet-400 hover:underline">
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
