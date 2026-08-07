import { SubNav } from "../../_components/site-nav";
import { SITE_MAX_W } from "../../_components/ui";
import { BackButton } from "../../_components/back-button";

// Ростер — справочник лиги: команды и игроки. Отдельно от студии: сюда пишут данные,
// а студия и таблица их только читают. Раздел сезона LOST S2 (открывается плиткой с хаба сезона).

const TABS = [
  { href: "/roster/teams", label: "Команды", hint: "Лого, wordmark, фото, цвет" },
  { href: "/roster/players", label: "Игроки", hint: "Ники, роли, фото, профили" },
];

export default function RosterLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubNav items={TABS} />
      <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
        <BackButton fallback="/standings" className="mb-4" />
        {children}
      </main>
    </>
  );
}
