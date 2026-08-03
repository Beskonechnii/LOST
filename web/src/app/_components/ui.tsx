import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

// Переиспользуемые презентационные примитивы UI. Без "use client" — можно тянуть в серверные
// страницы. Задают единый ритм заголовков, чипов и плашек, чтобы страницы выглядели одним набором,
// а не собранными вручную каждая по-своему. Интерактивные варианты (сегменты с onClick) живут
// в клиентских компонентах рядом с их состоянием.

/**
 * Единая ширина контента сайта — один токен на шапку, подменю и колонку каждой страницы, чтобы они
 * совпадали по краю и не разъезжались (раньше было вразнобой 72–96rem). 96rem (1536px) — баланс:
 * заметно шире прежних 72–86rem, на широком экране остаётся воздух по краям, но не «поле в пустоте».
 * Плей-офф — исключение: его сетка нарочно во всю ширину экрана (full-bleed), см. страницу плей-офф.
 */
export const SITE_MAX_W = "max-w-[96rem]";

/** Надпись-категория над заголовком секции: 11px, uppercase, положительный трекинг. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle ${className}`}>{children}</p>
  );
}

/** Шапка секции: eyebrow + заголовок слева, счётчик/действие справа. */
export function SectionHeader({
  eyebrow,
  title,
  aside,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-[28px]">{title}</h1>
      </div>
      {aside && <div className="shrink-0 pb-1 text-sm text-ink-subtle">{aside}</div>}
    </div>
  );
}

/** Небольшой чип-метка (роль, тег, статус). База — shadcn Badge; вид LOST задаём поверх:
    капсула rounded-full, surface-2, приглушённый текст, 10px. */
export function Chip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={`gap-1 rounded-full border-hairline bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-ink-muted ${className}`}
    >
      {children}
    </Badge>
  );
}

/** Плитка показателя: подпись сверху, крупное число, опциональная сноска. */
export function StatTile({
  label,
  value,
  hint,
  valueClass = "text-ink",
  accent = false,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  valueClass?: string;
  /** Акцентная плитка — подсветка ключевого показателя (место, очки). */
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3.5 py-3 ${
        accent ? "border-accent/25 bg-accent/10" : "border-hairline bg-surface-1"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">{label}</div>
      <div className={`mt-0.5 text-xl font-extrabold tabular-nums tracking-tight ${valueClass}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-subtle">{hint}</div>}
    </div>
  );
}

/**
 * Полоска силы 0–100% в акценте. Показывает величину «на глаз» рядом с числом —
 * MMR игрока, урон, что угодно нормированное. Ширину считает вызывающий.
 */
export function Meter({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <div className={`h-1 overflow-hidden rounded-full bg-surface-3 ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-accent to-accent-bright"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}
