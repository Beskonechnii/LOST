import { HubTiles, type HubTile } from "@/app/_components/hub-tiles";

export const metadata = { title: "Инструменты" };

// Хаб операторской: те же пункты, что раньше были вторым рядом навигации, но плитками с коротким
// описанием — чтобы с порога было видно, что где, а не гадать по вкладке.

const TOOLS: HubTile[] = [
  { href: "/underbeer", label: "UNDERBEER 2.0", icon: "🍺", desc: "Шоу-драфт: капитаны по очереди собирают команды из ростера." },
  { href: "/admin/series", label: "Архив серий", icon: "🗂️", desc: "Встречи турнира и карты в них — отсюда стата идёт в статистику." },
  { href: "/admin/tp", label: "TP", icon: "🏅", desc: "Начисление сезонных очков MVP игрокам." },
  { href: "/studio/editor", label: "Студия", icon: "🎨", desc: "Сборка турнирной графики по данным ростера." },
  { href: "/match", label: "Матч", icon: "📊", desc: "Постгейм-отчёт по ID матча из Dota 2." },
  { href: "/admin/vision", label: "Варды", icon: "👁️", desc: "Карта расстановки вардов команды по архиву." },
  { href: "/admin/single-draft", label: "single draft", icon: "🎲", desc: "Случайный герой по каждой характеристике." },
  { href: "/admin/1x1", label: "1х1", icon: "🛠️", desc: "Турнир 1х1.", soon: true },
  { href: "/admin/fearless-draft", label: "fearless draft", icon: "🛠️", desc: "Fearless draft.", soon: true },
];

export default function AdminHome() {
  return (
    <main className="mx-auto w-full max-w-[96rem] flex-1 px-4 py-8 md:px-6">
      <HubTiles eyebrow="Служебная часть" title="Инструменты" tiles={TOOLS} />
    </main>
  );
}
