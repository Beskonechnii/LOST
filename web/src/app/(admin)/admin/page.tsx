import { HubGroupedTiles, type HubTile } from "@/app/_components/hub-tiles";
import { currentPermissions } from "@/lib/account";
import type { PermissionKey } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Инструменты" };

// Хаб операторской: те же пункты, что раньше были вторым рядом навигации, но плитками с коротким
// описанием — чтобы с порога было видно, что где, а не гадать по вкладке.
//
// Плитку показываем только при наличии права (docs/archive/ACCOUNTS-PLAN.md §5): не видно того, чем нельзя
// пользоваться. Это витрина, а не защита — сами разделы и пишущие роуты проверяют право у себя.

type Tool = HubTile & { perm: PermissionKey };

// Инструментов полтора десятка, и плоской сеткой уже не читается, что относится к шоу, что к
// модерации, а что к аналитике — поэтому плитки разложены по блокам.
const GROUPS: { title: string; tools: Tool[] }[] = [
  {
    title: "Showmatch",
    tools: [
      { href: "/underbeer", perm: "underbeer", label: "UNDERBEER 2.0", icon: "🍺", desc: "Шоу-драфт: капитаны по очереди собирают команды из ростера." },
      { href: "/admin/single-draft", perm: "tools", label: "single draft", icon: "🎲", desc: "Случайный герой по каждой характеристике." },
      { href: "/admin/1x1", perm: "tools", label: "1х1", icon: "🛠️", desc: "Турнир 1х1.", soon: true },
      { href: "/admin/fearless-draft", perm: "tools", label: "fearless draft", icon: "🚫", desc: "Драфт героев без повторов по серии: баны, пики, fearless-пул." },
    ],
  },
  {
    title: "Модерация",
    tools: [
      { href: "/admin/tournaments", perm: "tournaments.edit", label: "Турниры", icon: "🏟️", desc: "Завести турнир, описать его, раздать дивизионы и составы." },
      { href: "/admin/registrations", perm: "accounts.approve", label: "Регистрации", icon: "📝", desc: "Очередь новых заявок: анкета, одобрение с заведением профиля или возврат с причиной." },
      { href: "/admin/claims", perm: "accounts.approve", label: "Заявки", icon: "🔗", desc: "Подтверждение привязки аккаунтов к профилям ростера." },
      { href: "/admin/staff", perm: "accounts.admins", label: "Команда лиги", icon: "🛡️", desc: "Владелец и админы: назначение роли и раздача прав по галочкам." },
      { href: "/admin/tp", perm: "tp.edit", label: "TP", icon: "🏅", desc: "Начисление сезонных очков MVP игрокам." },
    ],
  },
  {
    title: "Аналитика",
    tools: [
      { href: "/match", perm: "tools", label: "Разбор матча", icon: "📊", desc: "Постгейм-отчёт по ID матча из Dota 2." },
      { href: "/admin/vision", perm: "tools", label: "Варды", icon: "👁️", desc: "Карта расстановки вардов команды по архиву." },
      { href: "/admin/stats", perm: "tools", label: "Показатели", icon: "📈", desc: "Топ-5 по каждой метрике: разрез дивизион / стадия / игроки или команды." },
    ],
  },
  {
    title: "Архив",
    tools: [
      { href: "/admin/series", perm: "series.edit", label: "Архив серий", icon: "🗂️", desc: "Встречи турнира и карты в них — отсюда стата идёт в статистику." },
    ],
  },
  {
    title: "Графика",
    tools: [
      { href: "/studio/editor", perm: "studio", label: "Студия", icon: "🎨", desc: "Сборка турнирной графики по данным ростера." },
    ],
  },
  {
    title: "UI",
    tools: [
      { href: "/admin/theme", perm: "theme", label: "Тема", icon: "🎛️", desc: "Цвета UI проекта: акцент, поверхности, текст. Правится и едет в data/theme.json." },
    ],
  },
];

export default async function AdminHome() {
  const perms = await currentPermissions();
  const groups = GROUPS.map((g) => ({ title: g.title, tiles: g.tools.filter((t) => perms.includes(t.perm)) }));
  const empty = groups.every((g) => g.tiles.length === 0);

  return (
    <main className="mx-auto w-full max-w-[96rem] flex-1 px-4 py-8 md:px-6">
      <HubGroupedTiles eyebrow="Служебная часть" title="Инструменты" groups={groups} />
      {empty && (
        <p className="mt-6 rounded-md border border-amber-900 bg-amber-950/40 px-3 py-2 text-sm text-amber-300">
          Роль админа есть, а прав пока нет: попросите владельца лиги отметить нужные разделы в
          «Команде лиги».
        </p>
      )}
    </main>
  );
}
