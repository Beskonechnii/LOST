import { SubNav } from "../../_components/site-nav";

// Раздел дивизиона. Пока он один, поэтому подразделы — по этапам, а не по дивизионам.

const TABS = [
  { href: "/standings", label: "Таблицы", hint: "Общая таблица лиги" },
  { href: "/standings/groups", label: "Групповая стадия", hint: "Группы A и B с сеткой встреч" },
  { href: "/standings/playoff", label: "Плей-офф", hint: "Черновик сетки: посев из групп" },
];

export default function StandingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubNav items={TABS} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">{children}</main>
    </>
  );
}
