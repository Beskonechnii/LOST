import Link from "next/link";
import { listPlayers } from "@/lib/studio-data";
import { CreateForm } from "../_components/editors";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const players = await listPlayers();

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Игроки</h1>
        <span className="text-sm text-neutral-500">{players.length} шт.</span>
      </div>

      <CreateForm
        url="/api/studio/players"
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
            href={`/studio/players/${p.id}`}
            className="flex items-center gap-3 rounded border border-neutral-800 bg-neutral-900/40 p-2 hover:border-violet-600"
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
              <div className="truncate text-sm font-medium">{p.nickname}</div>
              <div className="truncate text-xs text-neutral-500">{p.team?.name ?? "без команды"}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
