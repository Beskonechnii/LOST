import { notFound } from "next/navigation";
import { SITE_MAX_W } from "@/app/_components/ui";
import { BackButton } from "@/app/_components/back-button";
import { divisionOfTournament } from "@/lib/tournaments";

// Раздел дивизиона внутри турнира: /tournaments/<турнир>/<дивизион>. Турнир в адресе не для красоты —
// имена и слаги дивизионов повторяются из сезона в сезон, и без него «d1» означал бы разное в разные
// годы, а прошлый сезон исчезал бы с витрины при старте нового. Старые /standings/<div>/* остались
// редиректом на текущий турнир, чтобы отданные наружу ссылки не ломались.
//
// Этапы (групповая / плей-офф / статистика) — плитки на хабе дивизиона (page.tsx), не ряд вкладок.

export default async function DivisionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; div: string }>;
}) {
  const { slug, div } = await params;
  const division = await divisionOfTournament(slug, div);
  if (!division) notFound();

  // Акцент секции = цвет дивизиона. D1 держит бренд-фиолетовый (дефолт токенов), D2 — бирюзовый
  // с тёмным текстом на плашках. Задаём CSS-переменные на обёртке — весь `accent`-хром внутри
  // (плитки, кнопки, ссылки) перекрашивается сам, без дублирования классов на каждой странице.
  // Значения берём из токенов темы (--lost-d2*), а не литералами — тогда цвет D2 правится в одном
  // месте, на панели /admin/theme, и здесь, и на бренд-хроме.
  const accentVars =
    division.slug === "d2"
      ? ({
          "--accent": "var(--lost-d2, #14c6cb)",
          "--accent-bright": "var(--lost-d2-bright, #5eead4)",
          "--accent-contrast": "var(--lost-d2-contrast, #000000)",
        } as React.CSSProperties)
      : undefined;

  // Ширина — единая на весь сайт (SITE_MAX_W): шапка и контент совпадают по краю.
  // Кнопку прячем на самом хабе дивизиона (page.tsx) — назад с него ведёт вкладка LOST S2;
  // на этапах (группы / плей-офф / статистика) она возвращает к хабу дивизиона.
  const base = `/tournaments/${slug}/${division.slug}`;
  return (
    <div style={accentVars}>
      <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
        <BackButton fallback={base} hideOn={[base]} className="mb-4" />
        {children}
      </main>
    </div>
  );
}
