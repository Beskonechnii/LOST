import { notFound } from "next/navigation";
import { SubNav } from "../../../_components/site-nav";
import { divisionBySlug } from "@/lib/divisions";

// Раздел дивизиона. Один шаблон на оба дивизиона: слаг в URL (d1/d2) выбирает дивизион, а подразделы —
// этапы внутри него (таблицы / групповая стадия / плей-офф). Раньше дивизион был один и подразделы
// жили прямо в /standings; теперь их два, поэтому этап уехал на уровень ниже — под [div].

export default async function DivisionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ div: string }>;
}) {
  const { div } = await params;
  const division = divisionBySlug(div);
  if (!division) notFound();

  const base = `/standings/${division.slug}`;
  const tabs = [
    { href: base, label: "Таблицы", hint: "Общая таблица лиги" },
    { href: `${base}/groups`, label: "Групповая стадия", hint: "Группы A и B с сеткой встреч" },
    { href: `${base}/playoff`, label: "Плей-офф", hint: "Черновик сетки: посев из групп" },
    { href: `${base}/stats`, label: "Статистика", hint: "Рейтинги игроков и команд по стадиям" },
  ];

  // Акцент секции = цвет дивизиона. D1 держит бренд-фиолетовый (дефолт токенов), D2 — бирюзовый
  // с тёмным текстом на плашках. Задаём CSS-переменные на обёртке — весь `accent`-хром внутри
  // (вкладки, кнопки, ссылки) перекрашивается сам, без дублирования классов на каждой странице.
  const accentVars =
    division.slug === "d2"
      ? ({ "--accent": "#14c6cb", "--accent-bright": "#5eead4", "--accent-contrast": "#000000" } as React.CSSProperties)
      : undefined;

  return (
    <div style={accentVars}>
      <SubNav items={tabs} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}
