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

/** Разделы продукта. Порядок тот же, что в верхней навигации, — карточки её и повторяют. */
const SECTIONS = [
  {
    href: "/standings/d1",
    title: "LOST D1",
    text: "Первый дивизион: таблица с зонами выхода, сетка групповой стадии и плей-офф. Правка результата встречи двигает и сетку, и таблицу.",
    cta: "Смотреть таблицу",
  },
  {
    href: "/standings/d2",
    title: "LOST D2",
    text: "Второй дивизион: своя таблица, группы и плей-офф. Считается по тем же правилам, что и первый.",
    cta: "Смотреть таблицу",
  },
  {
    href: "/roster/teams",
    title: "Ростер",
    text: "Команды дивизиона и их составы: роли, MMR основы, профили игроков со ссылками на Dotabuff и Stratz.",
    cta: "Открыть команды",
  },
  {
    href: "/match",
    title: "Разбор матча",
    text: "Постгейм по ID любого матча Dota 2 — счёт, драфт, скорборд, таланты, предметы и график преимущества. Не только матчи лиги.",
    cta: "Разобрать матч",
  },
];

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
      <section className="relative overflow-hidden border-b border-neutral-800">
        {/* фирменное свечение — та же пара цветов, что у знака в шапке */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-violet-600/25 to-fuchsia-600/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-violet-300">Dota 2 · Минск</p>
          <h1 className="mt-4 text-4xl font-black uppercase leading-none tracking-tight md:text-6xl">
            League of Spirit
          </h1>
          <p className="mt-4 max-w-xl text-lg text-neutral-300">
            Больше чем турнир — это твоё киберспортивное комьюнити.
          </p>
          <p className="mt-2 max-w-xl text-sm text-neutral-500">
            Сезонные турниры по Dota 2 с собственным кастом. Здесь живут таблица дивизиона, составы команд
            и разбор матчей.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/standings/d1"
              className="rounded-md bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
            >
              Таблица дивизиона
            </Link>
            <Link
              href="/match"
              className="rounded-md border border-neutral-700 px-5 py-2.5 text-sm font-semibold text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
            >
              Разобрать матч
            </Link>
          </div>

          <dl className="mt-12 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="text-3xl font-black tabular-nums text-neutral-100">{s.value}</dd>
                <p className="mt-0.5 text-xs uppercase tracking-wide text-neutral-500">{s.label}</p>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Разделы: карточка = пункт меню, чтобы «что тут вообще есть» читалось без клика */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 transition-colors hover:border-violet-600/60 hover:bg-neutral-900/70"
            >
              <h2 className="text-base font-bold text-neutral-100">{s.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-400">{s.text}</p>
              <span className="mt-4 text-sm font-medium text-violet-400 transition-colors group-hover:text-violet-300">
                {s.cta} →
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-10 text-sm text-neutral-500">
          Основной сайт лиги и анонсы сезона —{" "}
          <a href={SITE} target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">
            leagueofspirits.ru
          </a>
          .
        </p>
      </section>
    </main>
  );
}
