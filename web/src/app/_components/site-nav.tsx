"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Навигация приложения. Верхняя строка (SiteNav) общая для всех разделов и живёт в корневом layout;
// вторая строка (SubNav) — подразделы конкретной секции, подключается её layout'ом (например, студией).

export type NavItem = { href: string; label: string; hint?: string };

const SECTIONS: NavItem[] = [
  { href: "/", label: "Матч", hint: "Отчёт из OpenDota по ID матча" },
  { href: "/standings", label: "Таблица", hint: "Standings лиги" },
  { href: "/roster", label: "Ростер", hint: "Команды и игроки лиги" },
  { href: "/studio", label: "Студия", hint: "Графика к матчам" },
];

/** Активен раздел, если путь совпадает или лежит внутри него («/» — только точное совпадение). */
function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const focus = "outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800/80 bg-neutral-950/85 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-4 px-4 md:px-6">
        <Link href="/" className={`flex shrink-0 items-center gap-2 rounded ${focus}`} title="League of Spirit">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-sm font-black text-white">
            L
          </span>
          <span className="hidden text-xs font-bold uppercase tracking-[0.2em] text-neutral-300 sm:block">LOST</span>
        </Link>

        <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto">
          {SECTIONS.map((s) => {
            const active = isActive(pathname, s.href);
            return (
              <Link
                key={s.href}
                href={s.href}
                title={s.hint}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${focus} ${
                  active
                    ? "bg-violet-600/15 font-medium text-violet-300"
                    : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

/** Подразделы секции. Подсвечивается самый конкретный подходящий пункт. */
export function SubNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const active = items
    .filter((t) => isActive(pathname, t.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    // 49px = высота SiteNav (h-12) вместе с его нижней границей — иначе при скролле щель в 1px
    <div className="sticky top-[49px] z-40 border-b border-neutral-900 bg-neutral-950/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl gap-4 overflow-x-auto px-4 md:px-6">
        {items.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            title={t.hint}
            aria-current={t.href === active ? "page" : undefined}
            className={`shrink-0 border-b-2 px-1 py-2 text-sm transition-colors ${focus} ${
              t.href === active
                ? "border-violet-500 text-neutral-100"
                : "border-transparent text-neutral-500 hover:text-neutral-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
