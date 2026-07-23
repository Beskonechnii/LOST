import Link from "next/link";
import { listPlayers } from "@/lib/roster-data";
import { roleLabel } from "@/lib/roles";
import { playerGaps } from "@/lib/profiles";
import { CreateForm } from "../editors";
import { PlayerAvatar } from "../_components/avatar";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const players = await listPlayers();
  // Без account_id игрок не подтягивается из OpenDota; остальные дыры анкеты — из CRM, их добиваем руками
  const noId = players.filter((p) => !p.accountId).length;
  const incomplete = players.filter((p) => playerGaps(p).length > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Игроки</h1>
        <span className="text-sm text-neutral-500">
          {players.length} шт.
          {noId > 0 && <span className="ml-2 text-amber-400">{noId} без account_id</span>}
          {incomplete > 0 && <span className="ml-2 text-neutral-500">{incomplete} с неполной анкетой</span>}
        </span>
      </div>

      <CreateForm
        url="/api/roster/players"
        submitLabel="Добавить игрока"
        fields={[
          { key: "nickname", label: "Ник", placeholder: "CHIPOLLINO" },
          { key: "accountId", label: "account_id", placeholder: "123456789" },
        ]}
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((p) => {
          const gaps = playerGaps(p);
          return (
            <Link
              key={p.id}
              href={`/roster/players/${p.id}`}
              className={`flex items-center gap-3 rounded border bg-neutral-900/40 p-2 hover:border-violet-600 ${
                p.accountId ? "border-neutral-800" : "border-amber-500/60 bg-amber-500/5"
              }`}
            >
              <PlayerAvatar
                photo={p.photo}
                nickname={p.nickname}
                color={p.main?.team.color}
                size={40}
                className="rounded-lg"
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
                {/* чек-лист анкеты: что осталось добить из CRM */}
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
