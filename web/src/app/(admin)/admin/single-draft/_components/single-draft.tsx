"use client";

import { useCallback, useEffect, useState } from "react";
import { localHeroes, type LocalHero } from "@/lib/dota-constants";
import { assetUrl, assetFallback } from "@/lib/assets";

// Single draft: по одному случайному герою на каждую характеристику (сила, ловкость,
// интеллект, универсал). Пул героев локальный (dota-constants), поэтому вся логика на клиенте —
// сервер не нужен, «перекрутить» мгновенно.

type Attr = "str" | "agi" | "int" | "all";

const ATTRS: { key: Attr; label: string; accent: string }[] = [
  { key: "str", label: "Сила", accent: "border-rose-500/40 bg-rose-500/10 text-rose-300" },
  { key: "agi", label: "Ловкость", accent: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  { key: "int", label: "Интеллект", accent: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  { key: "all", label: "Универсал", accent: "border-violet-500/40 bg-violet-500/10 text-violet-300" },
];

const slug = (h: LocalHero) => h.name.replace(/^npc_dota_hero_/, "");
const pick = (pool: LocalHero[]) => pool[Math.floor(Math.random() * pool.length)];

function roll(): Record<Attr, LocalHero | null> {
  const all = localHeroes();
  const out = {} as Record<Attr, LocalHero | null>;
  for (const { key } of ATTRS) {
    const pool = all.filter((h) => h.primary_attr === key);
    out[key] = pool.length ? pick(pool) : null;
  }
  return out;
}

function HeroCard({ attr, hero }: { attr: (typeof ATTRS)[number]; hero: LocalHero | null }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface-1">
      <div className={`border-b px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] ${attr.accent}`}>
        {attr.label}
      </div>
      <div className="flex flex-col items-center gap-3 px-4 py-6">
        {hero ? (
          <>
            {/* иконка героя: локальный ассет → фолбэк на CDN Valve при 404 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetUrl("heroes", slug(hero))}
              alt={hero.localized_name}
              className="h-auto w-full max-w-[220px] rounded-lg ring-1 ring-black/50"
              onError={(e) => {
                const img = e.currentTarget;
                const fb = assetFallback("heroes", slug(hero));
                if (!img.src.endsWith(fb)) img.src = fb;
              }}
            />
            <div className="text-center text-base font-bold text-ink">{hero.localized_name}</div>
          </>
        ) : (
          <div className="py-10 text-sm text-ink-subtle">—</div>
        )}
      </div>
    </div>
  );
}

export function SingleDraft() {
  // Первый рендер — пустой (одинаков на сервере и клиенте), героев кидаем в эффекте:
  // Math.random() в рендере разошёлся бы между SSR и гидрацией.
  const [draft, setDraft] = useState<Record<Attr, LocalHero | null> | null>(null);
  const reroll = useCallback(() => setDraft(roll()), []);
  // Первый бросок — ровно на монтировании: это не «производное состояние», а клиентский Math.random,
  // которому нельзя в рендер (разъедется с SSR). Правило про setState-в-эффекте этот случай не ловит.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => reroll(), [reroll]);

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={reroll}
        className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90"
      >
        🎲 Перекрутить
      </button>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {ATTRS.map((a) => (
          <HeroCard key={a.key} attr={a} hero={draft?.[a.key] ?? null} />
        ))}
      </div>
    </div>
  );
}
