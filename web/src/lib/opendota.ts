// OpenDota: тянем стату матча. Ключ не нужен. Детальные поля (урон по строениям, хилл,
// денаи, порядок скиллов, тайминги покупок, баффы, график преимущества) есть только
// у распарсенных матчей (version != null); иначе — пусто/нули.

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenDota ${res.status} ${url}`);
  return res.json() as Promise<T>;
}

// --- Сырые формы OpenDota (только нужные поля) ---
type RawPlayer = {
  isRadiant?: boolean;
  name?: string | null;
  personaname?: string | null;
  hero_id: number;
  level?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  last_hits?: number;
  denies?: number;
  gold_per_min?: number;
  xp_per_min?: number;
  net_worth?: number;
  hero_damage?: number;
  tower_damage?: number;
  hero_healing?: number;
  item_0?: number;
  item_1?: number;
  item_2?: number;
  item_3?: number;
  item_4?: number;
  item_5?: number;
  backpack_0?: number;
  backpack_1?: number;
  backpack_2?: number;
  item_neutral?: number;
  ability_upgrades_arr?: number[] | null;
  purchase_log?: { key: string; time: number }[] | null;
  permanent_buffs?: { permanent_buff: number; stack_count: number }[] | null;
  account_id?: number | null;
  camps_stacked?: number;
  lane_role?: number | null;
};
type RawMatch = {
  match_id: number;
  version?: number | null;
  radiant_win?: boolean;
  duration?: number;
  radiant_score?: number;
  dire_score?: number;
  radiant_team?: { name?: string } | null;
  dire_team?: { name?: string } | null;
  radiant_gold_adv?: number[] | null;
  radiant_xp_adv?: number[] | null;
  picks_bans?: { order: number; is_pick: boolean; team: number; hero_id: number }[] | null;
  objectives?: { type?: string; player_slot?: number }[] | null;
  players: RawPlayer[];
};

// Сущность с картинкой: name — для показа, slug — имя ассета (см. src/lib/assets.ts).
export type Entity = { name: string; slug: string };

// --- Кэши на процесс ---
let heroCache: Map<number, Entity> | null = null;
async function heroInfo(): Promise<Map<number, Entity>> {
  if (heroCache) return heroCache;
  const arr = await getJson<{ id: number; name: string; localized_name: string }[]>(
    "https://api.opendota.com/api/heroes",
  );
  // slug из name (npc_dota_hero_antimage → antimage) — совпадает с sync-assets.ts
  heroCache = new Map(arr.map((h) => [h.id, { name: h.localized_name, slug: h.name.replace(/^npc_dota_hero_/, "") }]));
  return heroCache;
}

type Constants = {
  itemIds: Record<string, string>;
  items: Record<string, { dname?: string }>;
  abilityIds: Record<string, string>;
  abilities: Record<string, { dname?: string }>;
  buffs: Record<string, string>;
};
let constsCache: Constants | null = null;
async function constants(): Promise<Constants> {
  if (constsCache) return constsCache;
  const base = "https://api.opendota.com/api/constants/";
  const [itemIds, items, abilityIds, abilities, buffs] = await Promise.all([
    getJson<Record<string, string>>(base + "item_ids"),
    getJson<Record<string, { dname?: string }>>(base + "items"),
    getJson<Record<string, string>>(base + "ability_ids"),
    getJson<Record<string, { dname?: string }>>(base + "abilities"),
    getJson<Record<string, string>>(base + "permanent_buffs"),
  ]);
  constsCache = { itemIds, items, abilityIds, abilities, buffs };
  return constsCache;
}

const pretty = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// --- Стата для синка (match-sync) ---
export type OdPlayerStat = {
  accountId: number;
  isRadiant: boolean;
  kills: number;
  deaths: number;
  assists: number;
  lastHits: number;
  heroDamage: number;
  netWorth: number;
  campsStacked: number;
};
export type OdMatch = { matchId: string; radiantWin: boolean; players: OdPlayerStat[] };

export async function fetchOpenDotaMatch(matchId: string): Promise<OdMatch> {
  const m = await getJson<RawMatch>(`https://api.opendota.com/api/matches/${matchId}`);
  return {
    matchId: String(m.match_id),
    radiantWin: !!m.radiant_win,
    players: (m.players ?? [])
      .filter((p) => p.account_id != null)
      .map((p) => ({
        accountId: p.account_id as number,
        isRadiant: !!p.isRadiant,
        kills: p.kills ?? 0,
        deaths: p.deaths ?? 0,
        assists: p.assists ?? 0,
        lastHits: p.last_hits ?? 0,
        heroDamage: p.hero_damage ?? 0,
        netWorth: p.net_worth ?? 0,
        campsStacked: p.camps_stacked ?? 0,
      })),
  };
}

export function mvpScore(s: {
  kills: number;
  deaths: number;
  assists: number;
  heroDamage: number;
  netWorth: number;
  campsStacked: number;
}): number {
  return s.kills * 3 + s.assists * 1.5 - s.deaths + s.heroDamage / 1000 + s.netWorth / 2000 + s.campsStacked;
}

// --- Расширенный отчёт по матчу (вставил id → полная стата) ---
export type PlayerReport = {
  side: "radiant" | "dire";
  pos: number; // 1..5 (эвристика), 0 — не определена
  role: string; // "Керри" … "Хард-сап"
  name: string;
  hero: Entity;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  lastHits: number;
  denies: number;
  gpm: number;
  xpm: number;
  netWorth: number;
  heroDamage: number;
  towerDamage: number;
  heroHealing: number;
  items: Entity[];
  backpack: Entity[];
  neutral: Entity | null;
  abilityOrder: Entity[];
  purchases: { name: string; slug: string; time: number }[];
  buffs: { name: string; stacks: number }[];
};
export type PickBan = { order: number; isPick: boolean; side: "radiant" | "dire"; hero: Entity };
export type MatchReport = {
  matchId: string;
  parsed: boolean;
  radiantWin: boolean;
  durationSeconds: number;
  radiantScore: number;
  direScore: number;
  radiantTeam: string | null;
  direTeam: string | null;
  aegis: { radiant: number; dire: number };
  goldAdv: number[];
  xpAdv: number[];
  picksBans: PickBan[];
  players: PlayerReport[];
};

const ROLE_LABEL: Record<number, string> = {
  1: "Керри",
  2: "Мид",
  3: "Оффлейн",
  4: "Софт-сап",
  5: "Хард-сап",
};

// Позиции 1–5 по эвристике: линия (lane_role) + фарм (net worth). Это приближение —
// детальные линии есть только у распарсенных матчей, и роли не всегда однозначны.
// Возвращает Map: индекс игрока в команде → позиция.
function assignPositions(side: { i: number; laneRole?: number | null; nw: number }[]): Map<number, number> {
  const pos = new Map<number, number>();
  const used = new Set<number>();
  const take = (pool: typeof side, p: number, pick: "max" | "min") => {
    const free = pool.filter((c) => !used.has(c.i)).sort((a, b) => (pick === "max" ? b.nw - a.nw : a.nw - b.nw));
    if (free.length) {
      pos.set(free[0].i, p);
      used.add(free[0].i);
    }
  };
  const lane = (n: number) => side.filter((p) => p.laneRole === n);
  take(lane(2), 2, "max"); // мид
  take(lane(1), 1, "max"); // керри из сейфлейна
  take(lane(1), 5, "min"); // хард-сап из сейфлейна
  take(lane(3), 3, "max"); // оффлейн из хардлейна
  take(lane(3), 4, "min"); // софт-сап из хардлейна
  // оставшихся (роум/джангл/нераспарсено) добиваем по фарму на свободные позиции
  const freePos = [1, 2, 3, 4, 5].filter((p) => ![...pos.values()].includes(p));
  side
    .filter((p) => !used.has(p.i))
    .sort((a, b) => b.nw - a.nw)
    .forEach((p, k) => freePos[k] != null && pos.set(p.i, freePos[k]));
  return pos;
}

export async function fetchMatchReport(matchId: string): Promise<MatchReport> {
  const [m, heroes, c] = await Promise.all([
    getJson<RawMatch>(`https://api.opendota.com/api/matches/${matchId}`),
    heroInfo(),
    constants(),
  ]);
  if (!m || !Array.isArray(m.players) || m.players.length === 0) {
    throw new Error(`Матч ${matchId} не найден или без данных`);
  }

  // id → сущность {name, slug}. slug = ключ константы (== имя ассета), name — читаемое имя.
  const itemEntity = (id?: number): Entity | null => {
    if (!id) return null;
    const key = c.itemIds[String(id)];
    return key ? { name: c.items[key]?.dname ?? pretty(key), slug: key } : { name: `#${id}`, slug: "" };
  };
  const abilityEntity = (id: number): Entity => {
    const key = c.abilityIds[String(id)];
    return key ? { name: c.abilities[key]?.dname ?? pretty(key), slug: key } : { name: `#${id}`, slug: "" };
  };
  const heroEntity = (id: number): Entity => heroes.get(id) ?? { name: `Hero ${id}`, slug: "" };

  // Позиции считаем отдельно по каждой стороне; ключ — индекс в общем массиве m.players.
  const asRoleInput = (pred: (p: RawPlayer) => boolean) =>
    m.players.map((p, i) => ({ i, laneRole: p.lane_role, nw: p.net_worth ?? 0, keep: pred(p) })).filter((x) => x.keep);
  const posMap = new Map<number, number>([
    ...assignPositions(asRoleInput((p) => !!p.isRadiant)),
    ...assignPositions(asRoleInput((p) => !p.isRadiant)),
  ]);

  const players: PlayerReport[] = m.players.map((p, i) => ({
    side: p.isRadiant ? "radiant" : "dire",
    pos: posMap.get(i) ?? 0,
    role: ROLE_LABEL[posMap.get(i) ?? 0] ?? "",
    name: p.name || p.personaname || "Аноним",
    hero: heroEntity(p.hero_id),
    level: p.level ?? 0,
    kills: p.kills ?? 0,
    deaths: p.deaths ?? 0,
    assists: p.assists ?? 0,
    lastHits: p.last_hits ?? 0,
    denies: p.denies ?? 0,
    gpm: p.gold_per_min ?? 0,
    xpm: p.xp_per_min ?? 0,
    netWorth: p.net_worth ?? 0,
    heroDamage: p.hero_damage ?? 0,
    towerDamage: p.tower_damage ?? 0,
    heroHealing: p.hero_healing ?? 0,
    items: [p.item_0, p.item_1, p.item_2, p.item_3, p.item_4, p.item_5]
      .map(itemEntity)
      .filter((x): x is Entity => !!x),
    backpack: [p.backpack_0, p.backpack_1, p.backpack_2].map(itemEntity).filter((x): x is Entity => !!x),
    neutral: itemEntity(p.item_neutral),
    abilityOrder: (p.ability_upgrades_arr ?? []).map(abilityEntity),
    purchases: (p.purchase_log ?? []).map((e) => ({
      name: c.items[e.key]?.dname ?? pretty(String(e.key)),
      slug: String(e.key),
      time: e.time,
    })),
    buffs: (p.permanent_buffs ?? []).map((b) => ({ name: pretty(c.buffs[String(b.permanent_buff)] ?? `#${b.permanent_buff}`), stacks: b.stack_count ?? 0 })),
  }));

  const aegis = { radiant: 0, dire: 0 };
  for (const o of m.objectives ?? []) {
    if (typeof o.type === "string" && o.type.includes("AEGIS")) {
      if ((o.player_slot ?? 0) < 128) aegis.radiant++;
      else aegis.dire++;
    }
  }

  const picksBans: PickBan[] = (m.picks_bans ?? [])
    .map((pb) => ({
      order: pb.order,
      isPick: pb.is_pick,
      side: (pb.team === 0 ? "radiant" : "dire") as "radiant" | "dire",
      hero: heroEntity(pb.hero_id),
    }))
    .sort((a, b) => a.order - b.order);

  return {
    matchId: String(m.match_id),
    parsed: m.version != null,
    radiantWin: !!m.radiant_win,
    durationSeconds: m.duration ?? 0,
    radiantScore: m.radiant_score ?? 0,
    direScore: m.dire_score ?? 0,
    radiantTeam: m.radiant_team?.name ?? null,
    direTeam: m.dire_team?.name ?? null,
    aegis,
    goldAdv: m.radiant_gold_adv ?? [],
    xpAdv: m.radiant_xp_adv ?? [],
    picksBans,
    players,
  };
}
