import { HubTiles, type HubTile } from "@/app/_components/hub-tiles";
import { SITE_MAX_W } from "@/app/_components/ui";

export const metadata = { title: "LOST S2" };

// Хаб сезона LOST S2: вместо ряда вкладок — плитки разделов. Дальше у дивизиона свой хаб
// (групповая / плей-офф / статистика), у ростера — команды/игроки.
const SECTIONS: HubTile[] = [
  { href: "/standings/d1", label: "Дивизион 1", icon: "1️⃣", desc: "Таблицы групп, плей-офф и статистика первого дивизиона." },
  { href: "/standings/d2", label: "Дивизион 2", icon: "2️⃣", desc: "Таблицы групп, плей-офф и статистика второго дивизиона." },
  { href: "/roster", label: "Ростер", icon: "👥", desc: "Команды и игроки лиги." },
  { href: "/tp", label: "TP", icon: "🏅", desc: "Сезонный зачёт очков MVP." },
];

export default function SeasonHome() {
  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <HubTiles eyebrow="League of Spirits · сезон 2" title="LOST S2" tiles={SECTIONS} cols={4} />
    </main>
  );
}
