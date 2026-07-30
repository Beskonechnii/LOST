import Link from "next/link";
import { listPlayers } from "@/lib/roster-data";
import { roleLabel } from "@/lib/roles";
import { playerGaps, teamAccent } from "@/lib/profiles";
import { isAdmin } from "@/lib/admin-session";
import { CreateForm } from "@/app/_components/roster-editors";
import { PlayerAvatar } from "../_components/avatar";

export const dynamic = "force-dynamic";

// Витрина игроков — публичная. Форма создания и статистика пробелов в анкетах видны
// только вошедшему: это операторская диагностика полноты данных, а не факт о лиге.
export default async function PlayersPage() {
  const players = await listPlayers();
  const authed = await isAdmin();
  // Без account_id игрок не подтягивается из OpenDota; остальные дыры анкеты — из CRM, их добиваем руками
  const noId = players.filter((p) => !p.accountId).length;
  const incomplete = players.filter((p) => playerGaps(p).length > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Игроки</h1>
        <span className="text-sm text-neutral-500">
          {players.length} шт.
          {authed && noId > 0 && <span className="ml-2 text-amber-400">{noId} без account_id</span>}
          {authed && incomplete > 0 && (
            <span className="ml-2 text-neutral-500">{incomplete} с неполной анкетой</span>
          )}
        </span>
      </div>

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

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((p) => {
          // Пробелы анкеты подсвечиваем только оператору — это состояние наших данных,
          // а не факт об игроке. Посетитель видит ровную сетку карточек.
          const gaps = authed ? playerGaps(p) : [];
          const flagId = authed && !p.accountId;
          return (
            <Link
              key={p.id}
              href={`/roster/players/${p.id}`}
              className={`flex items-center gap-3 rounded border bg-neutral-900/40 p-2 hover:border-violet-600 ${
                flagId ? "border-amber-500/60 bg-amber-500/5" : "border-neutral-800"
              }`}
            >
              <PlayerAvatar
                photo={p.photo}
                nickname={p.nickname}
                color={p.main ? teamAccent(p.main.team) : null}
                size={56}
                className="rounded-xl"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {p.nickname}
                  {p.main?.isCaptain && <span className="ml-2 text-xs text-violet-400">(C)</span>}
                </div>
                <div className="truncate text-xs text-neutral-500">
                  {[
                    p.main?.team.name ?? "без команды",
                    roleLabel(p.main?.role),
                    p.mmr ? `${p.mmr.toLocaleString("ru")} MMR` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {/* стоит ещё где-то (обычно заменой) — показываем, чтобы не выглядело потерянным */}
                {p.spots.length > 1 && (
                  <div className="truncate text-xs text-neutral-600">
                    ещё в {p.spots.slice(1).map((s) => s.team.name).join(", ")}
                  </div>
                )}
                {/* чек-лист анкеты: что осталось добить из CRM (пусто для посетителя) */}
                {gaps.length > 0 && (
                  <div className={`truncate text-xs ${p.accountId ? "text-neutral-600" : "text-amber-400"}`}>
                    нет: {gaps.join(", ")}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
