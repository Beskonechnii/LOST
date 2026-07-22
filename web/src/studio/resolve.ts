// Разворачивание payload формы (id строкой) в данные для рендера (объекты команд/игроков).
// Используется и в живом превью (клиент, справочники уже загружены), и на серверной
// странице /studio/render/[templateId] — источник один, расхождений между превью и PNG нет.

import type { Data, FieldDef, PlayerRef, RawPayload, RawRow, ResolvedRow, TeamRef } from "./types";

export type Refs = { teams: TeamRef[]; players: PlayerRef[] };

export function resolvePayload(fields: FieldDef[], payload: RawPayload, refs: Refs): Data {
  const teamById = new Map(refs.teams.map((t) => [String(t.id), t]));
  const playerById = new Map(refs.players.map((p) => [String(p.id), p]));

  const one = (f: FieldDef, raw: string | undefined) => {
    if (f.kind === "team") return teamById.get(raw ?? "") ?? null;
    if (f.kind === "player") return playerById.get(raw ?? "") ?? null;
    return raw ?? "";
  };

  const out: Data = {};
  for (const f of fields) {
    const raw = payload[f.key];
    if (f.kind === "group") {
      const rows = Array.isArray(raw) ? raw : [];
      out[f.key] = rows.map((row: RawRow) => {
        const r: ResolvedRow = {};
        for (const sub of f.fields) r[sub.key] = one(sub, row[sub.key]);
        return r;
      });
    } else {
      out[f.key] = one(f, typeof raw === "string" ? raw : "");
    }
  }
  return out;
}
