import { notFound } from "next/navigation";
import { divisionOfTournament } from "@/lib/tournaments";
import { HubTiles, type HubTile } from "@/app/_components/hub-tiles";
import { BackButton } from "@/app/_components/back-button";

// Хаб дивизиона: плитки этапов вместо ряда вкладок. Сама групповая стадия уехала на /groups,
// чтобы адрес дивизиона держал список разделов, как «Админ» держит список инструментов.
export default async function DivisionHome({ params }: { params: Promise<{ slug: string; div: string }> }) {
  const { slug, div } = await params;
  const division = await divisionOfTournament(slug, div);
  if (!division) notFound();

  const base = `/tournaments/${slug}/${division.slug}`;
  const tiles: HubTile[] = [
    { href: `${base}/groups`, label: "Групповая стадия", icon: "📋", desc: "Таблицы групп и сетка личных встреч." },
    { href: `${base}/playoff`, label: "Плей-офф", icon: "🏆", desc: "Сетка плей-офф с посевом из групп." },
    { href: `${base}/stats`, label: "Статистика", icon: "📈", desc: "Рейтинги игроков и команд по стадиям." },
  ];

  return (
    <>
      <BackButton fallback={`/tournaments/${slug}`} className="mb-4" />
      <HubTiles eyebrow={division.tournament.name} title={division.label ?? division.name} tiles={tiles} />
    </>
  );
}
