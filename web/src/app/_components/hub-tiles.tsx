import Link from "next/link";
import { Eyebrow } from "./ui";
import { Card } from "@/components/pouf/surface";
import { Heading } from "@/components/pouf/text";
import { Badge } from "@/components/pouf/media";

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
    <div className="font-pouf">
      <Eyebrow className="mb-2">{eyebrow}</Eyebrow>
      <h1 className="text-[28px] font-black leading-[1.2] tracking-[-0.5px] text-ink md:text-4xl">{title}</h1>

      <div className={`mt-6 grid gap-4 ${COLS[cols]}`}>
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="group block">
            <Card motion="lift">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-purple text-xl text-[var(--on-accent)] cushion-blob">
                  <span className="[transform:translateY(-1px)]">{t.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Heading level={3}>{t.label}</Heading>
                    {t.soon && <Badge tone="warn">в разработке</Badge>}
                  </div>
                  <p className="mt-1 text-sm font-bold text-muted">{t.desc}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
