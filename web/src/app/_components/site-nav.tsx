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

const focus = "outline-none focus-visible:ring-[3px] focus-visible:ring-purple";

/** Общая раскладка верхней строки — отличаются только наполнением и акцентом.
 *  Визуал 1st-Pouf: пилюли-«подушки», Nunito, лого-Blob. Активный раздел вжат внутрь
 *  (cushion-control), неактивный — тихий контур, поднимается на hover. */
function Bar({
  sections,
  brand,
  aside,
}: {
  sections: NavItem[];
  brand: React.ReactNode;
  aside: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <header className="pouf-lost sticky top-0 z-50 border-b border-hairline bg-canvas/85 font-pouf backdrop-blur" data-theme="dark">
      <div className={`mx-auto flex h-14 ${SITE_MAX_W} items-center gap-4 px-4 md:px-6`}>
        {brand}

        <nav className="-mx-1 flex flex-1 gap-2 overflow-x-auto px-1 py-2">
          {sections.map((s) => {
            const active = isActive(pathname, s);
            return (
              <Link
                key={s.href}
                href={s.href}
                title={s.hint}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-[14px] px-4 py-[9px] text-[13px] font-black transition-[box-shadow,transform,background] ${focus} ${
                  active
                    ? "bg-purple text-[var(--on-accent)] cushion-control"
                    : "text-ink-muted hover:bg-surface-1 hover:text-ink hover:cushion-field"
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

/** Логотип-ссылка на главную — один для всего сайта. Пухлый бренд-Blob в духе pouf. */
const brand = (
  <Link href="/" className={`flex shrink-0 items-center gap-3 rounded-control ${focus}`} title="League of Spirits">
    <span className="grid h-9 w-9 place-items-center rounded-[14px] bg-purple text-[15px] font-black text-[var(--on-accent)] cushion-blob">
      L
    </span>
    <span className="hidden text-xs font-black uppercase tracking-[0.2em] text-ink-muted sm:block">
      League&nbsp;of&nbsp;Spirits
    </span>
  </Link>
);

/** Неприметная дверь для входа/выхода оператора — справа, одна на весь сайт. */
const accessLink = (
  <Link
    href="/admin/login"
    title="Вход в админку"
    className={`shrink-0 rounded-[14px] px-3 py-1.5 text-xs font-bold text-ink-subtle transition-colors hover:text-ink-muted ${focus}`}
  >
    Доступ
  </Link>
);

// Верхняя строка теперь единая: LOST S2 и Админ стоят рядом, обе группы рисуют её одинаково.
// PublicNav/AdminNav оставлены отдельными функциями лишь потому, что их зовут разные layout'ы —
// содержимое у них общее.
function TopBar() {
  return <Bar sections={TOP_SECTIONS} brand={brand} aside={accessLink} />;
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
    // 57px = высота верхней строки (h-14) вместе с её нижней границей — иначе при скролле щель в 1px
    <div className="pouf-lost sticky top-[57px] z-40 border-b border-hairline bg-canvas/85 font-pouf backdrop-blur" data-theme="dark">
      <nav className={`mx-auto flex ${SITE_MAX_W} gap-2 overflow-x-auto px-4 py-2 md:px-6`}>
        {items.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            title={t.hint}
            aria-current={t.href === active ? "page" : undefined}
            className={`shrink-0 rounded-[14px] px-4 py-[9px] text-[13px] font-black transition-[box-shadow,transform,background] ${focus} ${
              t.href === active
                ? "bg-purple text-[var(--on-accent)] cushion-control"
                : "text-ink-muted hover:bg-surface-1 hover:text-ink hover:cushion-field"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
