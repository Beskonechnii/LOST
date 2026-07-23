import Link from "next/link";
import { listPlayers } from "@/lib/roster-data";
import { roleLabel } from "@/lib/roles";
import { CreateForm } from "../editors";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const players = await listPlayers();
  // Временная подсветка: без account_id игрок не подтягивается из OpenDota, такие карточки надо добить
  const noId = players.filter((p) => !p.accountId).length;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Игроки</h1>
        <span className="text-sm text-neutral-500">
          {players.length} шт.
          {noId > 0 && <span className="ml-2 text-amber-400">{noId} без account_id</span>}
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
        {players.map((p) => (
          <Link
            key={p.id}
            href={`/roster/players/${p.id}`}
            className={`flex items-center gap-3 rounded border bg-neutral-900/40 p-2 hover:border-violet-600 ${
              p.accountId ? "border-neutral-800" : "border-amber-500/60 bg-amber-500/5"
            }`}
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded bg-neutral-900">
              {p.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] text-neutral-600">—</span>
              )}
            </div>
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
              {!p.accountId && <div className="text-xs text-amber-400">нет account_id</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
