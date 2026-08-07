import Link from "next/link";
import { Eyebrow } from "./ui";

// Плитки-хаб раздела: вместо ряда вкладок — карточки с иконкой, названием и одной строкой описания.
// Один вид для админки и продукта («архивный» pouf: surface-1, мягкая тень, подъём на hover),
// чтобы разделы выглядели одним набором. Сам <main> задаёт вызывающая страница/layout.

export type HubTile = { href: string; label: string; desc: string; icon: string; soon?: boolean };

// Раскладка сетки под число плиток: 3 (дивизион, админка) и 4 (сезон) — самые частые.
const COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function HubTiles({
  eyebrow,
  title,
  tiles,
  cols = 3,
}: {
  eyebrow: string;
  title: string;
  tiles: HubTile[];
  cols?: 2 | 3 | 4;
}) {
  return (
    <>
      <Eyebrow className="mb-2">{eyebrow}</Eyebrow>
      <h1 className="text-2xl font-bold tracking-tight text-ink md:text-[28px]">{title}</h1>

      <div className={`mt-6 grid gap-4 ${COLS[cols]}`}>
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group flex items-start gap-3 rounded-2xl border border-hairline bg-surface-1 p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_14px_40px_-26px_rgba(0,0,0,0.9)] transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface-2"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl">{t.icon}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">{t.label}</span>
                {t.soon && (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                    в разработке
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-ink-muted">{t.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
