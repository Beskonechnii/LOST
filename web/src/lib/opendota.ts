// OpenDota: тянем стату матча. Ключ не нужен. Детальные поля (урон по строениям, хилл,
// денаи, порядок скиллов, тайминги покупок, баффы, график преимущества) есть только
// у распарсенных матчей (version != null); иначе — пусто/нули.

// Полные описания талантов (с числами) — сгенерированы из Dota 2 Wiki, т.к. в константах
// OpenDota значения {s:...} не подставлены (~59% талантов). См. scripts/build-talents.mjs.
import talentNames from "./talents.json";
import { localConstants, localHeroes } from "./dota-constants";

// OpenDota регулярно отдаёт 429 (рейт-лимит) и 5xx от Cloudflare — чаще всего 522/524,
// когда их бэкенд не ответил вовремя. Это не ошибка запроса, а «попробуй ещё раз»,
// поэтому такие ответы ретраим с нарастающей паузой, а наружу отдаём текст для человека.
const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524]);
const RETRIES = 3;
const TIMEOUT_MS = 20_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function odError(status: number): Error {
  if (status === 429) return new Error("OpenDota ограничил частоту запросов (429). Подожди минуту и попробуй снова.");
  if (RETRY_STATUS.has(status))
    return new Error(`OpenDota сейчас недоступна (${status}). Это на их стороне — попробуй через пару минут.`);
  if (status === 404) return new Error("OpenDota не знает такой матч (404). Проверь ID.");
  return new Error(`OpenDota ответила ${status}.`);
}

async function getJson<T>(url: string): Promise<T> {
  let last: Error | null = null;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt) await sleep(500 * 2 ** (attempt - 1)); // 0.5с → 1с → 2с
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.ok) return (await res.json()) as T;
      last = odError(res.status);
      if (!RETRY_STATUS.has(res.status)) throw last;
    } catch (e) {
      // Обрыв связи и таймаут ретраим так же, как 5xx; ошибку статуса пробрасываем как есть.
      if (e === last) throw e;
      last = new Error("Не достучались до OpenDota — сеть или таймаут.");
    }
  }
  throw last ?? new Error("OpenDota недоступна.");
}

// --- Сырые формы OpenDota (только нужные поля) ---
// Запись лога варда: постановка (obs/sen_log) или снятие (obs/sen_left_log).
// x/y — мировые координаты миникарты (64..192), ehandle — id сущности, связывает пару.
type WardLogEntry = { time: number; x: number; y: number; ehandle?: number; player_slot?: number; attackername?: string };
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
  obs_placed?: number; // парс
  sen_placed?: number; // парс
  // Логи вардов (только у распарсенных): постановка и снятие/истечение. ehandle связывает пару.
  obs_log?: WardLogEntry[] | null;
  sen_log?: WardLogEntry[] | null;
  obs_left_log?: WardLogEntry[] | null;
  sen_left_log?: WardLogEntry[] | null;
  lane_role?: number | null;
  player_slot?: number; // <128 — свет, иначе тьма; нужен для резолва событий objectives
};
type RawTeam = { name?: string; tag?: string; logo_url?: string } | null;
type RawObjective = { type?: string; time?: number; player_slot?: number; team?: number; key?: string; killer?: number };
export type RawMatch = {
  match_id: number;
  version?: number | null;
  radiant_win?: boolean;
  duration?: number;
  start_time?: number; // unix-секунды начала матча — для даты в шапке отчёта
  radiant_score?: number;
  dire_score?: number;
  radiant_team?: RawTeam;
  dire_team?: RawTeam;
  tower_status_radiant?: number | null;
  tower_status_dire?: number | null;
  barracks_status_radiant?: number | null;
  barracks_status_dire?: number | null;
  radiant_gold_adv?: number[] | null;
  radiant_xp_adv?: number[] | null;
  picks_bans?: { order: number; is_pick: boolean; team: number; hero_id: number }[] | null;
  objectives?: RawObjective[] | null;
  players: RawPlayer[];
};

// Сущность с картинкой: name — для показа, slug — имя ассета (см. src/lib/assets.ts).
export type Entity = { name: string; slug: string };

// --- Кэши на процесс ---
let heroCache: Map<number, Entity> | null = null;
async function heroInfo(): Promise<Map<number, Entity>> {
  if (heroCache) return heroCache;
  const arr = localHeroes().length
    ? localHeroes()
    : await getJson<{ id: number; name: string; localized_name: string }[]>("https://api.opendota.com/api/heroes");
  // slug из name (npc_dota_hero_antimage → antimage) — совпадает с sync-assets.ts
  heroCache = new Map(arr.map((h) => [h.id, { name: h.localized_name, slug: h.name.replace(/^npc_dota_hero_/, "") }]));
  return heroCache;
}

// Герой по slug'у (для данных, где хранится только slug — например варды из БД). Из вендоренного
// справочника, синхронно; неизвестный slug — прямой prettify как фолбэк.
let heroSlugCache: Map<string, Entity> | null = null;
export function heroBySlug(slug: string): Entity {
  if (!heroSlugCache) {
    heroSlugCache = new Map(
      localHeroes().map((h) => {
        const s = h.name.replace(/^npc_dota_hero_/, "");
        return [s, { name: h.localized_name, slug: s }];
      }),
    );
  }
  return heroSlugCache.get(slug) ?? { name: slug ? pretty(slug) : "", slug };
}

type HeroAbilities = { talents?: { name: string; level: number }[] };
type Constants = {
  itemIds: Record<string, string>;
  items: Record<string, { dname?: string }>;
  abilityIds: Record<string, string>;
  abilities: Record<string, { dname?: string }>;
  heroAbilities: Record<string, HeroAbilities>;
  buffs: Record<string, string>;
};
let constsCache: Constants | null = null;
async function constants(): Promise<Constants> {
  if (constsCache) return constsCache;
  // Основной источник — вендоренная копия (см. lib/dota-constants.ts). Сеть остаётся
  // запасным путём: если файл почему-то пуст, работаем как раньше, через их API.
  const local = localConstants();
  if (Object.keys(local.itemIds).length) {
    constsCache = local;
    return constsCache;
  }
  const base = "https://api.opendota.com/api/constants/";
  const [itemIds, items, abilityIds, abilities, heroAbilities, buffs] = await Promise.all([
    getJson<Record<string, string>>(base + "item_ids"),
    getJson<Record<string, { dname?: string }>>(base + "items"),
    getJson<Record<string, string>>(base + "ability_ids"),
    getJson<Record<string, { dname?: string }>>(base + "abilities"),
    getJson<Record<string, HeroAbilities>>(base + "hero_abilities"),
    getJson<Record<string, string>>(base + "permanent_buffs"),
  ]);
  constsCache = { itemIds, items, abilityIds, abilities, heroAbilities, buffs };
  return constsCache;
}

const pretty = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// dname талантов содержит шаблоны `{s:...}` со значением, которого нет в этой константе.
// Числа подставить неоткуда — убираем токен (и знак/единицу рядом), оставляя суть таланта.
const cleanTalent = (s: string) =>
  s
    .replace(/[+\-±]?\{[^}]*\}[a-z%]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();

// Подсказка MVP. Форма параметра структурная — считается и от строки MatchStat, и от PlayerReport.
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

// Ярус дерева талантов: героический уровень (10/15/20/25) и две стороны.
// ВАЖНО: в hero_abilities пара идёт [правый, левый] (Ability10/12/… — правая ветка),
// поэтому первый элемент пары кладём в right, второй — в left (как в самой игре).
export type TalentOpt = { name: string; picked: boolean };
export type TalentTier = { heroLevel: number; left: TalentOpt | null; right: TalentOpt | null };

// --- Расширенный отчёт по матчу (вставил id → полная стата) ---
export type PlayerReport = {
  side: "radiant" | "dire";
  pos: number; // 1..5 (эвристика), 0 — не определена
  role: string; // "Керри" … "Хард-сап"
  accountId: number | null; // steam32 — для распознавания команды лиги по составу
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
  // Только у распарсенных матчей — иначе нули. В архив уходят как есть, честнее нуля-заглушки.
  campsStacked: number;
  obsPlaced: number;
  senPlaced: number;
  items: Entity[];
  backpack: Entity[];
  neutral: Entity | null;
  hasScepter: boolean; // Аганим (предмет в слоте или скушанный бафф)
  hasShard: boolean; // Шард (предмет в слоте или скушанный бафф)
  talents: TalentTier[]; // дерево талантов (25 → 10 сверху вниз)
  abilityOrder: Entity[]; // порядок прокачки способностей (без талантов)
  purchases: { name: string; slug: string; time: number }[];
  buffs: { name: string; stacks: number }[];
};
export type PickBan = { order: number; isPick: boolean; side: "radiant" | "dire"; hero: Entity };
export type Side = "radiant" | "dire";

// Строения одной стороны, декодированные из битмасок tower/barracks_status.
export type Lane = "top" | "mid" | "bot";
export type SideBuildings = {
  towers: { lane: Lane; tier: 1 | 2 | 3; alive: boolean }[];
  ancient: { top: boolean; bottom: boolean }; // две башни у трона (alive)
  racks: { lane: Lane; ranged: boolean; melee: boolean }[]; // казармы (alive)
};

// Убийца события — игрок (ник + герой) либо только герой (для курьеров резолвим по hero_id).
export type EventActor = { name: string; hero: Entity };
export type MatchEvents = {
  firstBlood: { time: number; side: Side; killer: EventActor | null } | null;
  firstTower: { time: number; side: Side; killer: EventActor | null } | null;
  roshan: { radiant: number; dire: number; kills: { time: number; side: Side }[] };
  couriers: { radiant: number; dire: number; kills: { time: number; victimSide: Side; killer: Entity | null }[] };
};

// Вард на карте: где, чей, какого типа, когда поставлен и когда снят/истёк.
// x/y — доля карты (0..1) от левого-верхнего угла, уже пересчитанные из мировых координат.
export type Ward = {
  side: Side;
  hero: Entity; // кто поставил
  type: "obs" | "sen"; // обсервер / сентри
  x: number; // 0..1 слева направо
  y: number; // 0..1 сверху вниз
  placed: number; // секунда постановки (может быть < 0 — префейз)
  left: number | null; // секунда снятия/истечения; null — дожил до конца матча
  killer: Entity | null; // герой, снявший вард (если снят раньше срока)
};

export type MatchReport = {
  matchId: string;
  parsed: boolean;
  radiantWin: boolean;
  durationSeconds: number;
  startTime: number;
  radiantScore: number;
  direScore: number;
  radiantTeam: string | null;
  direTeam: string | null;
  radiantTag: string | null;
  direTag: string | null;
  radiantLogo: string | null;
  direLogo: string | null;
  aegis: { radiant: number; dire: number };
  goldAdv: number[];
  xpAdv: number[];
  buildings: { radiant: SideBuildings; dire: SideBuildings };
  events: MatchEvents;
  picksBans: PickBan[];
  players: PlayerReport[];
  wards: Ward[]; // расстановка вардов по времени (пусто у нераспарсенных и Steam-источника)
};

// --- Декод битмасок строений (бит=1 → строение цело) ---
// Раскладка Valve (см. WebAPI/GetMatchDetails; подтверждено порядком в odota/web BuildingMap):
// tower_status, от LSB: 0 top-t1, 1 top-t2, 2 top-t3, 3 mid-t1, 4 mid-t2, 5 mid-t3,
// 6 bot-t1, 7 bot-t2, 8 bot-t3, 9 anc-top, 10 anc-bottom.
function decodeTowers(mask: number | null | undefined): SideBuildings {
  const m = mask ?? 0;
  const bit = (n: number) => (m & (1 << n)) !== 0;
  return {
    ancient: { top: bit(9), bottom: bit(10) },
    towers: [
      { lane: "top", tier: 1, alive: bit(0) },
      { lane: "top", tier: 2, alive: bit(1) },
      { lane: "top", tier: 3, alive: bit(2) },
      { lane: "mid", tier: 1, alive: bit(3) },
      { lane: "mid", tier: 2, alive: bit(4) },
      { lane: "mid", tier: 3, alive: bit(5) },
      { lane: "bot", tier: 1, alive: bit(6) },
      { lane: "bot", tier: 2, alive: bit(7) },
      { lane: "bot", tier: 3, alive: bit(8) },
    ],
    // казармы дозаполним из barracks-маски отдельно
    racks: [],
  };
}
// barracks_status, от LSB: 0 top-melee, 1 top-ranged, 2 mid-melee, 3 mid-ranged, 4 bot-melee, 5 bot-ranged.
function decodeRacks(mask: number | null | undefined): SideBuildings["racks"] {
  const m = mask ?? 0;
  const bit = (n: number) => (m & (1 << n)) !== 0;
  return [
    { lane: "top", melee: bit(0), ranged: bit(1) },
    { lane: "mid", melee: bit(2), ranged: bit(3) },
    { lane: "bot", melee: bit(4), ranged: bit(5) },
  ];
}

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
  const m = await getJson<RawMatch>(`https://api.opendota.com/api/matches/${matchId}`);
  return buildMatchReport(String(matchId), m);
}

// Сборка отчёта отделена от загрузки: форма RawMatch — это форма Valve GetMatchDetails
// плюс поля OpenDota, поэтому второй источник (см. lib/steam-match.ts) переиспользует
// ровно эту функцию, а не дублирует резолв имён, позиции и декод строений.
export async function buildMatchReport(matchId: string, m: RawMatch): Promise<MatchReport> {
  const [heroes, c] = await Promise.all([heroInfo(), constants()]);
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

  // Дерево талантов героя: пары по ярусам (level 1..4 → герой-уровни 10/15/20/25),
  // отдаём сверху вниз (25 → 10). picked — по ключам из ability_upgrades_arr.
  const talentTree = (heroSlug: string, upgradeKeys: Set<string>): TalentTier[] => {
    const ha = c.heroAbilities[`npc_dota_hero_${heroSlug}`];
    if (!ha?.talents?.length) return [];
    const byTier = new Map<number, TalentOpt[]>();
    for (const t of ha.talents) {
      // Приоритет: полное описание из вики → очищенный dname OpenDota → человекочитаемый ключ.
      const name =
        (talentNames as Record<string, string>)[t.name] ??
        cleanTalent(c.abilities[t.name]?.dname ?? pretty(t.name));
      const opt = { name, picked: upgradeKeys.has(t.name) };
      (byTier.get(t.level) ?? byTier.set(t.level, []).get(t.level)!).push(opt);
    }
    // Пара [0]=правый, [1]=левый талант (см. коммент к TalentTier).
    return [4, 3, 2, 1]
      .filter((tier) => byTier.has(tier))
      .map((tier) => {
        const pair = byTier.get(tier)!;
        return { heroLevel: tier * 5 + 5, right: pair[0] ?? null, left: pair[1] ?? null };
      });
  };

  // Позиции считаем отдельно по каждой стороне; ключ — индекс в общем массиве m.players.
  const asRoleInput = (pred: (p: RawPlayer) => boolean) =>
    m.players.map((p, i) => ({ i, laneRole: p.lane_role, nw: p.net_worth ?? 0, keep: pred(p) })).filter((x) => x.keep);
  const posMap = new Map<number, number>([
    ...assignPositions(asRoleInput((p) => !!p.isRadiant)),
    ...assignPositions(asRoleInput((p) => !p.isRadiant)),
  ]);

  const players: PlayerReport[] = m.players.map((p, i) => {
    const items = [p.item_0, p.item_1, p.item_2, p.item_3, p.item_4, p.item_5]
      .map(itemEntity)
      .filter((x): x is Entity => !!x);
    const backpack = [p.backpack_0, p.backpack_1, p.backpack_2].map(itemEntity).filter((x): x is Entity => !!x);
    // Аганим/Шард: либо предмет в инвентаре, либо скушанный перманентный бафф
    // (permanent_buffs: 2 = ultimate_scepter, 12 = aghanims_shard).
    const buffIds = new Set((p.permanent_buffs ?? []).map((b) => b.permanent_buff));
    const slugs = new Set([...items, ...backpack].map((e) => e.slug));
    const hasScepter = buffIds.has(2) || slugs.has("ultimate_scepter") || slugs.has("ultimate_scepter_2");
    const hasShard = buffIds.has(12) || slugs.has("aghanims_shard");
    // Все прокачанные способности (id → ключ); таланты выносим в дерево, из порядка убираем.
    const hero = heroEntity(p.hero_id);
    const upgradeKeys = (p.ability_upgrades_arr ?? []).map((id) => c.abilityIds[String(id)]).filter(Boolean);
    const upgradeSet = new Set(upgradeKeys);
    return {
      side: p.isRadiant ? "radiant" : "dire",
      pos: posMap.get(i) ?? 0,
      role: ROLE_LABEL[posMap.get(i) ?? 0] ?? "",
      accountId: p.account_id ?? null,
      name: p.name || p.personaname || "Аноним",
      hero,
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
      campsStacked: p.camps_stacked ?? 0,
      obsPlaced: p.obs_placed ?? 0,
      senPlaced: p.sen_placed ?? 0,
      items,
      backpack,
      neutral: itemEntity(p.item_neutral),
      hasScepter,
      hasShard,
      talents: talentTree(hero.slug, upgradeSet),
      abilityOrder: (p.ability_upgrades_arr ?? [])
        .map(abilityEntity)
        .filter((a) => a.slug && !a.slug.startsWith("special_bonus")),
      purchases: (p.purchase_log ?? []).map((e) => ({
        name: c.items[e.key]?.dname ?? pretty(String(e.key)),
        slug: String(e.key),
        time: e.time,
      })),
      buffs: (p.permanent_buffs ?? []).map((b) => ({ name: pretty(c.buffs[String(b.permanent_buff)] ?? `#${b.permanent_buff}`), stacks: b.stack_count ?? 0 })),
    };
  });

  const sideOfSlot = (slot: number | undefined): Side => ((slot ?? 0) < 128 ? "radiant" : "dire");

  // Слот игрока → актор (ник + герой) для резолва «кто сделал». Слот есть у каждого игрока матча.
  const slotActor = new Map<number, EventActor>();
  m.players.forEach((p) => {
    if (p.player_slot != null) {
      slotActor.set(p.player_slot, { name: p.name || p.personaname || "Аноним", hero: heroEntity(p.hero_id) });
    }
  });

  const aegis = { radiant: 0, dire: 0 };
  const events: MatchEvents = {
    firstBlood: null,
    firstTower: null,
    roshan: { radiant: 0, dire: 0, kills: [] },
    couriers: { radiant: 0, dire: 0, kills: [] },
  };
  for (const o of m.objectives ?? []) {
    const t = o.type;
    if (!t) continue;
    if (t.includes("AEGIS")) {
      if ((o.player_slot ?? 0) < 128) aegis.radiant++;
      else aegis.dire++;
    } else if (t === "CHAT_MESSAGE_FIRSTBLOOD" && !events.firstBlood) {
      events.firstBlood = {
        time: o.time ?? 0,
        side: sideOfSlot(o.player_slot),
        killer: slotActor.get(o.player_slot ?? -1) ?? null,
      };
    } else if (t === "building_kill" && !events.firstTower && typeof o.key === "string" && o.key.includes("tower")) {
      // Сторона убийцы — противоположна владельцу вышки (goodguys=свет). player_slot точнее, если есть.
      const side: Side = o.player_slot != null ? sideOfSlot(o.player_slot) : o.key.includes("goodguys") ? "dire" : "radiant";
      events.firstTower = { time: o.time ?? 0, side, killer: slotActor.get(o.player_slot ?? -1) ?? null };
    } else if (t === "CHAT_MESSAGE_ROSHAN_KILL") {
      // team: 2 — рошана убил свет, 3 — тьма.
      const side: Side = o.team === 2 ? "radiant" : "dire";
      events.roshan[side]++;
      events.roshan.kills.push({ time: o.time ?? 0, side });
    } else if (t === "CHAT_MESSAGE_COURIER_LOST") {
      // team — чей курьер погиб (2 свет / 3 тьма); убийца — противоположная сторона, killer=hero_id.
      const victimSide: Side = o.team === 2 ? "radiant" : "dire";
      const killerSide: Side = victimSide === "radiant" ? "dire" : "radiant";
      events.couriers[killerSide]++;
      events.couriers.kills.push({
        time: o.time ?? 0,
        victimSide,
        killer: o.killer ? heroEntity(o.killer) : null, // killer=0 → не герой (вышка/крип)
      });
    }
  }

  const buildings = {
    radiant: { ...decodeTowers(m.tower_status_radiant), racks: decodeRacks(m.barracks_status_radiant) },
    dire: { ...decodeTowers(m.tower_status_dire), racks: decodeRacks(m.barracks_status_dire) },
  };

  // --- Варды: постановка + снятие/истечение по каждому игроку ---
  // Мировые координаты миникарты — 64..192 по обеим осям, свет в низу-слева (как detailed_740).
  // Доля карты: x → слева направо; y инвертируем (большой y — верх карты).
  const frac = (v: number) => Math.min(1, Math.max(0, (v - 64) / 128));
  const wardXY = (x: number, y: number) => ({ x: frac(x), y: 1 - frac(y) });
  // Ресурс жизни варда — чтобы отличить снятие врагом от честного истечения (obs 6 мин, sen 7 мин).
  const WARD_LIFE = { obs: 360, sen: 420 };
  // Герой по npc-имени из attackername (npc_dota_hero_storm_spirit → Storm Spirit).
  const heroBySlug = new Map<string, Entity>([...heroes.values()].map((h) => [h.slug, h]));
  const killerOf = (name?: string): Entity | null =>
    (name && heroBySlug.get(name.replace(/^npc_dota_hero_/, ""))) || null;
  // ehandle → запись снятия (по всем игрокам, оба типа): ehandle уникален в матче.
  const leftByHandle = new Map<number, WardLogEntry>();
  for (const p of m.players) {
    for (const e of [...(p.obs_left_log ?? []), ...(p.sen_left_log ?? [])]) {
      if (e.ehandle != null) leftByHandle.set(e.ehandle, e);
    }
  }
  const wards: Ward[] = [];
  for (const p of m.players) {
    const side: Side = p.isRadiant ? "radiant" : "dire";
    const hero = heroEntity(p.hero_id);
    for (const [type, log] of [["obs", p.obs_log], ["sen", p.sen_log]] as const) {
      for (const e of log ?? []) {
        const gone = e.ehandle != null ? leftByHandle.get(e.ehandle) : undefined;
        const left = gone?.time ?? null;
        // Снят врагом — если исчез заметно раньше максимального срока жизни.
        const destroyed = left != null && left - e.time < WARD_LIFE[type] - 5;
        wards.push({
          side,
          hero,
          type,
          ...wardXY(e.x, e.y),
          placed: e.time,
          left,
          killer: destroyed ? killerOf(gone?.attackername) : null,
        });
      }
    }
  }
  wards.sort((a, b) => a.placed - b.placed);

  const picksBans: PickBan[] = (m.picks_bans ?? [])
    .map((pb) => ({
      order: pb.order,
      isPick: pb.is_pick,
      side: (pb.team === 0 ? "radiant" : "dire") as "radiant" | "dire",
      hero: heroEntity(pb.hero_id),
    }))
    .sort((a, b) => a.order - b.order);

  return {
    matchId: String(m.match_id ?? matchId),
    parsed: m.version != null,
    radiantWin: !!m.radiant_win,
    durationSeconds: m.duration ?? 0,
    startTime: m.start_time ?? 0,
    radiantScore: m.radiant_score ?? 0,
    direScore: m.dire_score ?? 0,
    radiantTeam: m.radiant_team?.name ?? null,
    direTeam: m.dire_team?.name ?? null,
    radiantTag: m.radiant_team?.tag || null,
    direTag: m.dire_team?.tag || null,
    radiantLogo: m.radiant_team?.logo_url || null,
    direLogo: m.dire_team?.logo_url || null,
    aegis,
    goldAdv: m.radiant_gold_adv ?? [],
    xpAdv: m.radiant_xp_adv ?? [],
    buildings,
    events,
    picksBans,
    players,
    wards,
  };
}
