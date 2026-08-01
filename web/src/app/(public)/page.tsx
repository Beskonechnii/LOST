import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

// Входная дверь продукта. До этого на `/` стояло поле ввода id матча — посетитель попадал
// в операторский инструмент и не понимал, куда пришёл. Здесь: что за лига и что тут можно сделать.
//
// Цифры берём из базы, а не пишем руками: подписи на витрине не должны расходиться с данными.
// Стиль — BRENDBOOK.md: тёмная тема, акцент violet-600.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "League of Spirit — киберспортивные турниры по Dota 2 в Минске. Таблица дивизиона, составы команд и разбор любого матча Dota 2.",
};

const SITE = "https://leagueofspirits.ru/lost_s1";

// Акцент = идентичность секции (перенос per-product identity из HashiCorp на дивизионы).
// Классы литеральные: Tailwind вычитывает их статически, динамические имена не соберутся.
const ACCENT = {
  d1: { hover: "hover:border-d1/60", cta: "text-d1-bright", rail: "bg-d1" },
  d2: { hover: "hover:border-d2/60", cta: "text-d2-bright", rail: "bg-d2" },
  none: { hover: "hover:border-ink-subtle/60", cta: "text-ink-muted", rail: "bg-surface-3" },
} as const;

/** Разделы продукта. Порядок тот же, что в верхней навигации, — карточки её и повторяют. */
const SECTIONS = [
  {
    href: "/standings/d1",
    title: "LOST D1",
    text: "Первый дивизион: таблица с зонами выхода, сетка групповой стадии и плей-офф. Правка результата встречи двигает и сетку, и таблицу.",
    cta: "Смотреть таблицу",
    accent: "d1",
  },
  {
    href: "/standings/d2",
    title: "LOST D2",
    text: "Второй дивизион: своя таблица, группы и плей-офф. Считается по тем же правилам, что и первый.",
    cta: "Смотреть таблицу",
    accent: "d2",
  },
  {
    href: "/roster/teams",
    title: "Ростер",
    text: "Команды дивизиона и их составы: роли, MMR основы, профили игроков со ссылками на Dotabuff и Stratz.",
    cta: "Открыть команды",
    accent: "none",
  },
] as const;

export default async function Home() {
  // Считаем прямо здесь: показать надо четыре числа, тянуть ради них выборки страниц незачем.
  // Считаем по всей лиге, а не по одному дивизиону: на витрине цифры общие (D1 + D2).
  const [teams, players, series, groups] = await Promise.all([
    prisma.team.count(),
    prisma.player.count(),
    prisma.series.count(),
    prisma.groupEntry.findMany({ distinct: ["division", "group"], select: { group: true } }),
  ]);

  const stats = [
    { value: teams, label: "команд" },
    { value: players, label: "игроков" },
    { value: groups.length, label: "групп" },
    { value: series, label: "сыгранных серий" },
  ];

  return (
    <main className="flex-1">
      {/* Первый экран: кто мы и куда идти дальше */}
      <section className="relative overflow-hidden border-b border-hairline">
        {/* фирменное свечение — акцент дивизиона D1 (наш основной бренд-фиолетовый) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-d1/25 to-d2/15 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <p className="eyebrow text-d1-bright">Dota 2 · Минск</p>
          {/* display-тип: плотный line-height + отрицательный трекинг — «голос» системы */}
          <h1 className="mt-4 text-5xl font-bold uppercase leading-[1.05] tracking-[-0.03em] md:text-7xl">
            League of Spirit
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted">
            Больше чем турнир — это твоё киберспортивное комьюнити.
          </p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-subtle">
            Сезонные турниры по Dota 2 с собственным кастом. Здесь живут таблица дивизиона и составы команд.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/standings/d1"
              className="rounded-md bg-d1 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-d1-bright hover:text-canvas"
            >
              Таблица дивизиона
            </Link>
            <Link
              href="/roster/teams"
              className="rounded-md border border-hairline-strong px-5 py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink"
            >
              Составы команд
            </Link>
          </div>

          {/* Цифры сезона — единой панелью с 1px-разделителями (gap-px на цвет hairline) */}
          <dl className="mt-12 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_16px_44px_-28px_rgba(0,0,0,0.9)] sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-surface-1 px-5 py-4">
                <dt className="sr-only">{s.label}</dt>
                <dd className="text-3xl font-extrabold tabular-nums tracking-tight text-ink">{s.value}</dd>
                <p className="eyebrow mt-1 text-ink-subtle">{s.label}</p>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Разделы: карточка = пункт меню, чтобы «что тут вообще есть» читалось без клика.
          Возвышение — surface-lift + мягкая тень, при наведении карточка приподнимается. */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <p className="eyebrow mb-6 text-ink-subtle">Разделы</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((s) => {
            const a = ACCENT[s.accent];
            return (
              <Link
                key={s.href}
                href={s.href}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface-1 p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_14px_40px_-26px_rgba(0,0,0,0.9)] transition duration-200 hover:-translate-y-0.5 hover:bg-surface-2 ${a.hover}`}
              >
                {/* тонкая цветная рейка сверху — секция «краем глаза» читается как D1/D2 */}
                <span aria-hidden className={`absolute inset-x-0 top-0 h-0.5 ${a.rail}`} />
                <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">{s.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-muted">{s.text}</p>
                <span className={`mt-4 inline-flex items-center gap-1 text-sm font-semibold transition-colors ${a.cta}`}>
                  {s.cta}
                  <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                </span>
              </Link>
            );
          })}
        </div>

        <p className="mt-10 text-sm text-ink-subtle">
          Основной сайт лиги и анонсы сезона —{" "}
          <a href={SITE} target="_blank" rel="noreferrer" className="text-d1-bright hover:underline">
            leagueofspirits.ru
          </a>
          .
        </p>
      </section>
    </main>
  );
}
