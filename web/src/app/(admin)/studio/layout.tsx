import { SubNav } from "../../_components/site-nav";

// Студия — только генерация графики. Профили команд и игроков живут в разделе «Ростер»,
// студия берёт их оттуда как справочник (src/lib/studio-refs.ts).
// Два способа получить картинку: собрать по шаблону из данных лиги или сгенерировать по промту.

const TABS = [
  { href: "/studio", label: "Шаблоны", hint: "Сборка графики по данным лиги" },
  { href: "/studio/generate", label: "Генерация", hint: "Картинки по промту через OpenAI" },
];

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubNav items={TABS} />
      <main className="mx-auto w-full max-w-[96rem] flex-1 px-4 py-8 md:px-6">{children}</main>
    </>
  );
}
