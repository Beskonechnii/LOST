import Link from "next/link";
import { listPlayers } from "@/lib/roster-data";
import { getPlayerRecords } from "@/lib/player-record";
import { roleLabel } from "@/lib/roles";
import { playerGaps, teamAccent } from "@/lib/profiles";
import { can } from "@/lib/account";
import { CreateForm } from "@/app/_components/roster-editors";
import { SectionHeader } from "@/app/_components/ui";
import { PlayerMiniCard } from "../_components/player-card";
import { DivTabs, parseDiv, divName } from "../_components/div-tabs";

export const dynamic = "force-dynamic";

// Разрезы сортировки живут в query — как рейтинги и постгейм: ссылку с нужным порядком можно
// кинуть в чат. `tp` первым, потому что сезонный зачёт — витринный смысл списка.
const SORTS = [
  { key: "tp", label: "По TP" },
  { key: "games", label: "По играм" },
  { key: "wins", label: "По победам" },
  { key: "losses", label: "По поражениям" },
  { key: "name", label: "По нику" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];
const isSort = (v: unknown): v is SortKey => SORTS.some((s) => s.key === v);

// Витрина игроков — публичная. Форма создания и статистика пробелов в анкетах видны
// только вошедшему: это операторская диагностика полноты данных, а не факт о лиге.
export default async function PlayersPage({ searchParams }: { searchParams: Promise<{ sort?: string; div?: string }> }) {
  const q = await searchParams;
  const sort: SortKey = isSort(q.sort) ? q.sort : "tp";
  const div = parseDiv(q.div);

  const [allPlayers, records] = await Promise.all([listPlayers(), getPlayerRecords(null)]);
  const authed = await can("roster.edit"); // формы и диагностика — те же права, что у пишущих роутов

  // Дивизион игрока — по его командам (Team.group): игрок попадает в D1/D2, если в этом дивизионе
  // у него есть место в составе. «Все» — весь пул, включая игроков без команды.
  const name = divName(div);
  const players = name ? allPlayers.filter((p) => p.spots.some((s) => s.team.group === name)) : allPlayers;

  // Карьерка игрока (игры/победы/поражения) — из турнирной статы (кирпич B). Нет статы → нули.
  const ranked = players.map((p) => {
    const rec = records.get(p.id) ?? { games: 0, wins: 0, losses: 0, winrate: 0 };
    return { ...p, rec };
  });
  const byName = (a: (typeof ranked)[number], b: (typeof ranked)[number]) => a.nickname.localeCompare(b.nickname);
  ranked.sort((a, b) => {
    switch (sort) {
      case "tp": return b.tp - a.tp || byName(a, b);
      case "games": return b.rec.games - a.rec.games || byName(a, b);
      case "wins": return b.rec.wins - a.rec.wins || byName(a, b);
      case "losses": return b.rec.losses - a.rec.losses || byName(a, b);
      default: return byName(a, b);
    }
  });
  // Без account_id игрок не подтягивается из OpenDota; остальные дыры анкеты — из CRM, их добиваем руками
  const noId = players.filter((p) => !p.accountId).length;
  const incomplete = players.filter((p) => playerGaps(p).length > 0).length;

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow="Ростер лиги"
        title="Игроки"
        aside={
          <>
            {players.length} игроков
            {authed && noId > 0 && <span className="ml-2 text-amber-400">{noId} без account_id</span>}
            {authed && incomplete > 0 && <span className="ml-2 text-ink-subtle">{incomplete} с неполной анкетой</span>}
          </>
        }
      />

      {authed && (
        <CreateForm
          url="/api/roster/players"
          submitLabel="Добавить игрока"
          fields={[
            { key: "nickname", label: "Ник", placeholder: "CHIPOLLINO" },
            { key: "accountId", label: "account_id", placeholder: "123456789" },
          ]}
        />
      )}

      <DivTabs current={div} base="/roster/players" keep={{ sort: sort === "tp" ? undefined : sort }} />

      <div className="flex flex-wrap gap-2 font-pouf">
        {SORTS.map((s) => {
          const params = new URLSearchParams();
          if (s.key !== "tp") params.set("sort", s.key);
          if (div) params.set("div", div);
          const qs = params.toString();
          return (
          <Link
            key={s.key}
            href={qs ? `/roster/players?${qs}` : "/roster/players"}
            className={`rounded-[14px] px-3.5 py-[7px] text-[13px] font-black transition-[box-shadow,transform,background] ${
              sort === s.key
                ? "bg-purple text-[var(--on-accent)] cushion-control"
                : "bg-surface text-ink-muted cushion-field hover:text-ink"
            }`}
          >
            {s.label}
          </Link>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ranked.map((p) => {
          // Пробелы анкеты подсвечиваем только оператору — это состояние наших данных,
          // а не факт об игроке. Посетитель видит ровную сетку карточек.
          const gaps = authed ? playerGaps(p) : [];
          const flagId = authed && !p.accountId;
          return (
            <PlayerMiniCard
              key={p.id}
              id={p.id}
              nickname={p.nickname}
              photo={p.photo}
              accent={p.main ? teamAccent(p.main.team) : null}
              role={roleLabel(p.main?.role)}
              mmr={p.mmr}
              isCaptain={p.main?.isCaptain ?? false}
              size={56}
              flagged={flagId}
              subtitle={
                <div className="mt-1 space-y-0.5">
                  <div className="truncate text-xs text-ink-subtle">{p.main?.team.name ?? "без команды"}</div>
                  {/* Турнирная карьерка и TP — то, по чему сортируется список. Показываем только
                      непустое: у игрока без турнирных карт строки нет, ноль-плашки не нужны. */}
                  {(p.rec.games > 0 || p.tp > 0) && (
                    <div className="flex flex-wrap items-center gap-x-2 text-xs tabular-nums text-ink-muted">
                      {p.rec.games > 0 && (
                        <span>
                          {p.rec.games} игр · <span className="text-emerald-400">{p.rec.wins}</span>–
                          <span className="text-rose-400">{p.rec.losses}</span>
                        </span>
                      )}
                      {p.tp > 0 && <span className="font-semibold text-accent-bright">{p.tp} TP</span>}
                    </div>
                  )}
                  {/* стоит ещё где-то (обычно заменой) — показываем, чтобы не выглядело потерянным */}
                  {p.spots.length > 1 && (
                    <div className="truncate text-xs text-ink-subtle">
                      ещё в {p.spots.slice(1).map((s) => s.team.name).join(", ")}
                    </div>
                  )}
                  {/* чек-лист анкеты: что осталось добить из CRM (пусто для посетителя) */}
                  {gaps.length > 0 && (
                    <div className={`truncate text-xs ${p.accountId ? "text-ink-subtle" : "text-amber-400"}`}>
                      нет: {gaps.join(", ")}
                    </div>
                  )}
                </div>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
