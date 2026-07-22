import { SubNav } from "../_components/site-nav";

// Студия — раздел генерации графики. Верхняя навигация приложения общая (корневой layout),
// здесь — только подразделы студии.

const TABS = [
  { href: "/studio", label: "Шаблоны", hint: "Собрать графику по шаблону" },
  { href: "/studio/teams", label: "Команды", hint: "Лого, wordmark, фото, цвет" },
  { href: "/studio/players", label: "Игроки", hint: "Ники, фото, позиции" },
];

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubNav items={TABS} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">{children}</main>
    </>
  );
}
