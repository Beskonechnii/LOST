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

// --- Кэши на процесс ---
let heroCache: Map<number, string> | null = null;
async function heroNames(): Promise<Map<number, string>> {
  if (heroCache) return heroCache;
  const arr = await getJson<{ id: number; localized_name: string }[]>("https://api.opendota.com/api/heroes");
  heroCache = new Map(arr.map((h) => [h.id, h.localized_name]));
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
  const m = await getJson<RawMatch & { players: (RawPlayer & { account_id?: number | null; camps_stacked?: number })[] }>(
    `https://api.opendota.com/api/matches/${matchId}`,
  );
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
  name: string;
  hero: string;
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
  items: string[];
  backpack: string[];
  neutral: string | null;
  abilityOrder: string[];
  purchases: { name: string; time: number }[];
  buffs: { name: string; stacks: number }[];
};
export type PickBan = { order: number; isPick: boolean; side: "radiant" | "dire"; hero: string };
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

export async function fetchMatchReport(matchId: string): Promise<MatchReport> {
  const [m, heroes, c] = await Promise.all([
    getJson<RawMatch>(`https://api.opendota.com/api/matches/${matchId}`),
    heroNames(),
    constants(),
  ]);
  if (!m || !Array.isArray(m.players) || m.players.length === 0) {
    throw new Error(`Матч ${matchId} не найден или без данных`);
  }

  const itemName = (id?: number): string | null => {
    if (!id) return null;
    const key = c.itemIds[String(id)];
    return key ? c.items[key]?.dname ?? pretty(key) : `#${id}`;
  };
  const abilityName = (id: number): string => {
    const key = c.abilityIds[String(id)];
    return key ? c.abilities[key]?.dname ?? pretty(key) : `#${id}`;
  };
  const heroName = (id: number) => heroes.get(id) ?? `Hero ${id}`;

  const players: PlayerReport[] = m.players.map((p) => ({
    side: p.isRadiant ? "radiant" : "dire",
    name: p.name || p.personaname || "Аноним",
    hero: heroName(p.hero_id),
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
      .map(itemName)
      .filter((x): x is string => !!x),
    backpack: [p.backpack_0, p.backpack_1, p.backpack_2].map(itemName).filter((x): x is string => !!x),
    neutral: itemName(p.item_neutral),
    abilityOrder: (p.ability_upgrades_arr ?? []).map(abilityName),
    purchases: (p.purchase_log ?? []).map((e) => ({ name: c.items[e.key]?.dname ?? pretty(String(e.key)), time: e.time })),
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
      hero: heroName(pb.hero_id),
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
