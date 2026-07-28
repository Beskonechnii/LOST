import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { draftPool } from "@/lib/draft-data";
import { memberIds, type DraftState, type PoolPlayer } from "@/lib/draft";
import { PlayerAvatar } from "@/app/(public)/roster/_components/avatar";

export const dynamic = "force-dynamic";

// «Голый» оверлей результата драфта для OBS-сцены: только составы, без операторских кнопок.
// Публичный (см. needsAdmin): у OBS админской куки нет. Игроки резолвятся из ростера по id.

export default async function OverlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, pool] = await Promise.all([
    prisma.draftSession.findUnique({ where: { id: Number(id) } }),
    draftPool(),
  ]);
  if (!session) notFound();

  let state: DraftState;
  try {
    state = JSON.parse(session.payload) as DraftState;
  } catch {
    notFound();
  }

  const byId = new Map(pool.map((p) => [p.id, p]));

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto grid max-w-7xl gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, state.teams.length)}, minmax(0, 1fr))` }}>
        {state.teams.map((team) => {
          const members = memberIds(team)
            .map((pid) => byId.get(pid))
            .filter((p): p is PoolPlayer => !!p);
          const mmrSum = members.reduce((s, p) => s + (p.mmr ?? 0), 0);
          return (
            <div
              key={team.id}
              className="overflow-hidden rounded-2xl border bg-neutral-950/85 backdrop-blur"
              style={{ borderColor: `${team.color}88` }}
            >
              <div className="flex items-center justify-between px-4 py-3" style={{ background: `${team.color}22` }}>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full" style={{ background: team.color }} />
                  <span className="text-lg font-bold">{team.name}</span>
                </div>
                <span className="text-xs text-neutral-400">Σ MMR {mmrSum.toLocaleString("ru-RU")}</span>
              </div>
              <div className="space-y-2 p-3">
                {members.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl bg-neutral-900/70 p-2">
                    <PlayerAvatar photo={p.photo} nickname={p.nickname} color={team.color} size={44} className="!rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-semibold">{p.nickname}</span>
                        {team.captainId === p.id && (
                          <span className="rounded bg-amber-500/25 px-1 text-[10px] font-bold text-amber-300">КАП</span>
                        )}
                        {team.locked.includes(p.id) && <span title="Закреплён">🔒</span>}
                      </div>
                      {p.realName && <div className="truncate text-xs text-neutral-500">{p.realName}</div>}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-medium">{p.mmr ? p.mmr.toLocaleString("ru-RU") : "—"}</div>
                      <div className="text-[10px] text-neutral-600">MMR</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
