import Link from "next/link";
import { DIVISIONS } from "@/lib/divisions";

// Вкладки дивизиона для страниц ростера: D1 / D2 / Все. Разрез живёт в query (?div=d1),
// как и в /standings и в рейтингах — ссылку с нужным дивизионом можно кинуть в чат.
// «Все» (значение null) — весь пул: игроки без команды видны только здесь.
export type DivFilter = "d1" | "d2" | null;

/** Значение query → фильтр. Всё, кроме d1/d2, считаем «Все» (в т.ч. отсутствие параметра). */
export const parseDiv = (v: unknown): DivFilter => (v === "d1" || v === "d2" ? v : null);

/** Имя дивизиона (Team.group) по фильтру; null — без фильтра. */
export const divName = (f: DivFilter): string | null =>
  f ? (DIVISIONS.find((d) => d.slug === f)?.name ?? null) : null;

/**
 * Ссылка вкладки: базовый путь + div + сохранённые прочие параметры (напр. sort на игроках).
 * div=null («Все») из URL убираем — это состояние по умолчанию.
 */
function href(base: string, f: DivFilter, keep: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(keep)) if (v) params.set(k, v);
  if (f) params.set("div", f);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function DivTabs({
  current,
  base,
  keep = {},
}: {
  current: DivFilter;
  base: string;
  keep?: Record<string, string | undefined>;
}) {
  const tabs: { key: DivFilter; label: string }[] = [
    ...DIVISIONS.map((d) => ({ key: d.slug as DivFilter, label: d.short })),
    { key: null, label: "Все" },
  ];
  return (
    <div className="flex flex-wrap gap-2 font-pouf">
      {tabs.map((t) => (
        <Link
          key={t.key ?? "all"}
          href={href(base, t.key, keep)}
          className={`rounded-[14px] px-3.5 py-[7px] text-[13px] font-black transition-[box-shadow,transform,background] ${
            current === t.key
              ? "bg-purple text-[var(--on-accent)] cushion-control"
              : "bg-surface text-ink-muted cushion-field hover:text-ink"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
