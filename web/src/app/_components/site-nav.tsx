"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Навигация. Две верхние строки, по одной на группу маршрутов:
//   PublicNav — продукт (src/app/(public)): разбор матча, таблица, витрина ростера;
//   AdminNav  — служебная часть (src/app/(admin)): студия и правка ростера.
// Вторая строка (SubNav) — подразделы конкретной секции, подключается её layout'ом.
//
// Разделять важно не ради красоты: пока навигация была общей, посетитель видел в меню студию
// и админку, а оператор не видел границы между «это увидят все» и «это только моё».

export type NavItem = { href: string; label: string; hint?: string };

const PUBLIC_SECTIONS: NavItem[] = [
  { href: "/match", label: "Матч", hint: "Разбор матча Dota 2 по ID" },
  { href: "/standings/d1", label: "LOST D1", hint: "Первый дивизион: таблица и групповая стадия" },
  { href: "/standings/d2", label: "LOST D2", hint: "Второй дивизион: таблица и групповая стадия" },
  { href: "/roster", label: "Ростер", hint: "Команды и игроки лиги" },
];

const ADMIN_SECTIONS: NavItem[] = [
  { href: "/studio", label: "Студия", hint: "Графика к матчам" },
  { href: "/admin/login", label: "Доступ", hint: "Вход и выход из админки" },
];

/** Активен раздел, если путь совпадает или лежит внутри него («/» — только точное совпадение). */
function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const focus = "outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

/** Общая раскладка верхней строки — отличаются только наполнением и акцентом. */
function Bar({
  sections,
  accent,
  brand,
  aside,
}: {
  sections: NavItem[];
  accent: string;
  brand: React.ReactNode;
  aside: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800/80 bg-neutral-950/85 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-4 px-4 md:px-6">
        {brand}

        <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto">
          {sections.map((s) => {
            const active = isActive(pathname, s.href);
            return (
              <Link
                key={s.href}
                href={s.href}
                title={s.hint}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${focus} ${
                  active ? accent : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>

        {aside}
      </div>
    </header>
  );
}

/** Навигация продукта: только то, что показываем посетителю. */
export function PublicNav() {
  return (
    <Bar
      sections={PUBLIC_SECTIONS}
      accent="bg-violet-600/15 font-medium text-violet-300"
      brand={
        <Link href="/" className={`flex shrink-0 items-center gap-2 rounded ${focus}`} title="League of Spirit">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-sm font-black text-white">
            L
          </span>
          <span className="hidden text-xs font-bold uppercase tracking-[0.2em] text-neutral-300 sm:block">LOST</span>
        </Link>
      }
      aside={
        // Неприметная дверь для оператора: посетителю она ни о чём не говорит.
        <Link
          href="/admin/login"
          title="Вход в админку"
          className={`shrink-0 rounded-md px-2 py-1.5 text-xs text-neutral-600 transition-colors hover:text-neutral-300 ${focus}`}
        >
          Админ
        </Link>
      }
    />
  );
}

/** Навигация служебной части. Янтарный акцент — чтобы «где я» читалось с одного взгляда. */
export function AdminNav() {
  return (
    <Bar
      sections={ADMIN_SECTIONS}
      accent="bg-amber-500/15 font-medium text-amber-300"
      brand={
        <span className="flex shrink-0 items-center gap-2" title="Служебная часть — её не видит посетитель">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-sm font-black text-neutral-950">
            L
          </span>
          <span className="hidden text-xs font-bold uppercase tracking-[0.2em] text-amber-300/80 sm:block">
            Админка
          </span>
        </span>
      }
      aside={
        <Link
          href="/"
          title="Вернуться на публичный сайт"
          className={`shrink-0 rounded-md px-2 py-1.5 text-xs text-neutral-500 transition-colors hover:text-neutral-200 ${focus}`}
        >
          ← На сайт
        </Link>
      }
    />
  );
}

/** Подразделы секции. Подсвечивается самый конкретный подходящий пункт. */
export function SubNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const active = items
    .filter((t) => isActive(pathname, t.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    // 49px = высота верхней строки (h-12) вместе с её нижней границей — иначе при скролле щель в 1px
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
