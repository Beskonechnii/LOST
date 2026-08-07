import { notFound } from "next/navigation";
import { SITE_MAX_W } from "../../../_components/ui";
import { BackButton } from "../../../_components/back-button";
import { divisionBySlug } from "@/lib/divisions";

// Раздел дивизиона. Один шаблон на оба дивизиона: слаг в URL (d1/d2) выбирает дивизион, а этапы
// (групповая / плей-офф / статистика) — плитки на хабе дивизиона (page.tsx), не ряд вкладок.

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

  // Акцент секции = цвет дивизиона. D1 держит бренд-фиолетовый (дефолт токенов), D2 — бирюзовый
  // с тёмным текстом на плашках. Задаём CSS-переменные на обёртке — весь `accent`-хром внутри
  // (плитки, кнопки, ссылки) перекрашивается сам, без дублирования классов на каждой странице.
  const accentVars =
    division.slug === "d2"
      ? ({ "--accent": "#14c6cb", "--accent-bright": "#5eead4", "--accent-contrast": "#000000" } as React.CSSProperties)
      : undefined;

  // Ширина — единая на весь сайт (SITE_MAX_W): шапка и контент совпадают по краю.
  // Кнопку прячем на самом хабе дивизиона (page.tsx) — назад с него ведёт вкладка LOST S2;
  // на этапах (группы / плей-офф / статистика) она возвращает к хабу дивизиона.
  const base = `/standings/${division.slug}`;
  return (
    <div style={accentVars}>
      <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
        <BackButton fallback={base} hideOn={[base]} className="mb-4" />
        {children}
      </main>
    </div>
  );
}
