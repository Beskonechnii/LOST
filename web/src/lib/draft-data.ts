// Пул игроков для шоу-драфта UNDERBEER 2.0 — снимок живого ростера на момент открытия сессии.
// Только чтение: команды драфта в ростер не пишут. Снимок кладётся в payload (см. draft.ts),
// поэтому прошлый драфт читается даже после ухода игрока из ростера.

import { listPlayers } from "@/lib/roster-data";
import { teamAccent } from "@/lib/profiles";
import { rolePosition } from "@/lib/roles";
import type { PoolPlayer } from "@/lib/draft";

/**
 * Плоский пул: каждый игрок один раз, позиция и цвет — по основному месту в ростере
 * (listPlayers уже кладёт его в `main`). У игрока без места позиция null.
 */
export async function draftPool(): Promise<PoolPlayer[]> {
  const players = await listPlayers();
  return players.map((p): PoolPlayer => {
    const spot = p.main;
    const team = spot?.team ?? null;
    return {
      id: p.id,
      nickname: p.nickname,
      realName: p.realName,
      photo: p.photo,
      mmr: p.mmr,
      role: spot?.role ?? null,
      position: rolePosition(spot?.role),
      // акцент ростерной команды для аватарки-заглушки; без команды — тон из слага игрока
      teamColor: team ? teamAccent(team) : teamAccent({ slug: p.slug, name: p.nickname }),
    };
  });
}
