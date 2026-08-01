import { SeasonNav, SubNav, SUBNAV_SECOND_ROW } from "../../_components/site-nav";

// Ростер — справочник лиги: команды и игроки. Отдельно от студии: сюда пишут данные,
// а студия и таблица их только читают. Живёт под сезоном LOST S2 (первый ряд — SeasonNav).

const TABS = [
  { href: "/roster/teams", label: "Команды", hint: "Лого, wordmark, фото, цвет" },
  { href: "/roster/players", label: "Игроки", hint: "Ники, роли, фото, профили" },
];

export default function RosterLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SeasonNav />
      <SubNav items={TABS} topClass={SUBNAV_SECOND_ROW} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">{children}</main>
    </>
  );
}
