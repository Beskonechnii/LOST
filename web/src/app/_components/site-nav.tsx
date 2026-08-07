"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_MAX_W } from "./ui";

// Навигация. Две верхние строки, по одной на группу маршрутов:
//   PublicNav — продукт (src/app/(public)): разбор матча, таблица, витрина ростера;
//   AdminNav  — служебная часть (src/app/(admin)): студия и правка ростера.
// Вторая строка (SubNav) — подразделы конкретной секции, подключается её layout'ом.
//
// Разделять важно не ради красоты: пока навигация была общей, посетитель видел в меню студию
// и админку, а оператор не видел границы между «это увидят все» и «это только моё».

// match — дополнительные префиксы, при которых пункт считается активным. Нужно секции, которая в URL
// живёт не под своим href: «LOST S2» ведёт на /standings/d1, но подсвечивается и на /roster.
export type NavItem = { href: string; label: string; hint?: string; match?: string[] };

// Верхняя строка — одна на весь сайт: продукт (LOST S2) и операторская (Админ) стоят рядом.
// Обе группы маршрутов рисуют эти же вкладки, поэтому переход между ними бесшовный: строка
// не меняется, меняется только второй ряд (подвкладки сезона / инструменты админки).
const TOP_SECTIONS: NavItem[] = [
  {
    href: "/standings",
    label: "LOST S2",
    hint: "Второй сезон: дивизионы и ростер",
    match: ["/standings", "/roster", "/series", "/tp"],
  },
  {
    href: "/admin",
    label: "Админ",
    hint: "Операторская: серии, студия, драфты, разбор матча",
    match: ["/admin", "/studio", "/underbeer", "/match"],
  },
];

/** Активен раздел, если путь совпадает или лежит внутри него («/» — только точное совпадение). */
function matchesHref(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Пункт активен по своему href или по любому из дополнительных префиксов match. */
function isActive(pathname: string, item: NavItem) {
  return matchesHref(pathname, item.href) || (item.match ?? []).some((m) => matchesHref(pathname, m));
}

const focus = "outline-none focus-visible:ring-2 focus-visible:ring-accent-bright";

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
    <header className="sticky top-0 z-50 border-b border-hairline bg-canvas/85 backdrop-blur">
      <div className={`mx-auto flex h-12 ${SITE_MAX_W} items-center gap-4 px-4 md:px-6`}>
        {brand}

        <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto">
          {sections.map((s) => {
            const active = isActive(pathname, s);
            return (
              <Link
                key={s.href}
                href={s.href}
                title={s.hint}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${focus} ${
                  active ? accent : "text-ink-muted hover:bg-surface-1 hover:text-ink"
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

/** Логотип-ссылка на главную — один для всего сайта. */
const brand = (
  <Link href="/" className={`flex shrink-0 items-center gap-2 rounded ${focus}`} title="League of Spirits">
    <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent to-fuchsia-600 text-sm font-black text-white">
      L
    </span>
    <span className="hidden text-xs font-bold uppercase tracking-[0.2em] text-ink-muted sm:block">
      League&nbsp;of&nbsp;Spirits
    </span>
  </Link>
);

/** Неприметная дверь для входа/выхода оператора — справа, одна на весь сайт. */
const accessLink = (
  <Link
    href="/admin/login"
    title="Вход в админку"
    className={`shrink-0 rounded-md px-2 py-1.5 text-xs text-ink-subtle transition-colors hover:text-ink-muted ${focus}`}
  >
    Доступ
  </Link>
);

// Верхняя строка теперь единая: LOST S2 и Админ стоят рядом, обе группы рисуют её одинаково.
// PublicNav/AdminNav оставлены отдельными функциями лишь потому, что их зовут разные layout'ы —
// содержимое у них общее.
function TopBar() {
  return <Bar sections={TOP_SECTIONS} accent="bg-accent/15 font-medium text-accent-bright" brand={brand} aside={accessLink} />;
}

/** Навигация продукта (группа public). */
export function PublicNav() {
  return <TopBar />;
}

/** Навигация служебной части (группа admin) — та же верхняя строка, что и у продукта. */
export function AdminNav() {
  return <TopBar />;
}

/** Подразделы секции (ростер, студия). Подсвечивается самый конкретный подходящий пункт. */
export function SubNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const active = items
    .filter((t) => isActive(pathname, t))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    // 49px = высота верхней строки (h-12) вместе с её нижней границей — иначе при скролле щель в 1px
    <div className="sticky top-[49px] z-40 border-b border-hairline bg-canvas/85 backdrop-blur">
      <nav className={`mx-auto flex ${SITE_MAX_W} gap-4 overflow-x-auto px-4 md:px-6`}>
        {items.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            title={t.hint}
            aria-current={t.href === active ? "page" : undefined}
            className={`shrink-0 border-b-2 px-1 py-2 text-sm transition-colors ${focus} ${
              t.href === active
                ? "border-accent-bright text-ink"
                : "border-transparent text-ink-subtle hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
