import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SITE_MAX_W, StatTile } from "@/app/_components/ui";
import { buttonClasses } from "@/components/pouf/Button";
import { Card } from "@/components/pouf/surface";
import { Heading, Eyebrow } from "@/components/pouf/text";

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
    href: "/standings/d1/groups",
    title: "LOST D1",
    text: "Первый дивизион: таблица с зонами выхода, сетка групповой стадии и плей-офф. Правка результата встречи двигает и сетку, и таблицу.",
    cta: "Смотреть таблицу",
    accent: "d1",
  },
  {
    href: "/standings/d2/groups",
    title: "LOST D2",
    text: "Второй дивизион: своя таблица, группы и плей-офф. Считается по тем же правилам, что и первый.",
    cta: "Смотреть таблицу",
    accent: "d2",
  },
  {
    href: "/tournaments",
    title: "Турниры",
    text: "Сезоны и кубки лиги: регламент, сроки, дивизионы и заявленные составы. Отсюда — вход в таблицы конкретного дивизиона.",
    cta: "Открыть турниры",
    accent: "none",
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
    <main className="flex-1 font-pouf">
      {/* Первый экран: кто мы и куда идти дальше */}
      <section className="relative overflow-hidden border-b border-hairline">
        {/* фирменное свечение — бренд-фиолетовый LOST */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-d1/25 to-d2/15 blur-3xl"
        />
        <div className={`relative mx-auto ${SITE_MAX_W} px-4 py-16 md:px-6 md:py-24`}>
          <Eyebrow>Dota 2 · Минск</Eyebrow>
          {/* display-тип: плотный line-height + отрицательный трекинг — «голос» pouf */}
          <h1 className="mt-4 text-5xl font-black uppercase leading-[1.05] tracking-[-0.03em] text-ink md:text-7xl">
            League of Spirit
          </h1>
          <p className="mt-5 max-w-xl text-lg font-bold leading-relaxed text-ink-muted">
            Больше чем турнир — это твоё киберспортивное комьюнити.
          </p>
          <p className="mt-2 max-w-xl text-sm font-bold leading-relaxed text-muted">
            Сезонные турниры по Dota 2 с собственным кастом. Здесь живут таблица дивизиона и составы команд.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/standings/d1/groups" className={buttonClasses({ size: "lg" })}>
              Таблица дивизиона
            </Link>
            <Link href="/roster/teams" className={buttonClasses({ size: "lg", variant: "quiet" })}>
              Составы команд
            </Link>
          </div>

          {/* Цифры сезона — четыре «подушки» pouf (StatTile) */}
          <dl className="mt-12 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <StatTile key={s.label} label={s.label} value={s.value} />
            ))}
          </dl>
        </div>
      </section>

      {/* Разделы: карточка = пункт меню, чтобы «что тут вообще есть» читалось без клика.
          Возвышение — «подушка» pouf, при наведении карточка приподнимается (motion=lift). */}
      <section className={`mx-auto ${SITE_MAX_W} px-4 py-12 md:px-6 md:py-16`}>
        <Eyebrow>Разделы</Eyebrow>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} className="group block">
              <Card motion="lift">
                <div className="flex h-full flex-col gap-3">
                  <Heading level={3}>{s.title}</Heading>
                  <p className="flex-1 text-sm font-bold leading-relaxed text-muted">{s.text}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-black text-[var(--purple)]">
                    {s.cta}
                    <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        <p className="mt-10 text-sm font-bold text-muted">
          Основной сайт лиги и анонсы сезона —{" "}
          <a href={SITE} target="_blank" rel="noreferrer" className="text-[var(--purple)] hover:underline">
            leagueofspirits.ru
          </a>
          .
        </p>
      </section>
    </main>
  );
}
