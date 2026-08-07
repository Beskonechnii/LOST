// Типы постгейм-отчёта (ответ /api/opendota/match/<id>) и мелкие форматтеры.
// Один источник для страницы матча и экспортного холста — расхождений между экраном и PNG нет.

export type Entity = { name: string; slug: string };
export type TalentOpt = { name: string; picked: boolean };
export type TalentTier = { heroLevel: number; left: TalentOpt | null; right: TalentOpt | null };
export type PlayerReport = {
  side: "radiant" | "dire";
  pos: number;
  role: string;
  accountId: number | null;
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
  hasScepter: boolean;
  hasShard: boolean;
  talents: TalentTier[];
  abilityOrder: Entity[];
  purchases: { name: string; slug: string; time: number }[];
  buffs: { name: string; stacks: number }[];
};
export type Side = "radiant" | "dire";
export type PickBan = { order: number; isPick: boolean; side: Side; hero: Entity };
export type Lane = "top" | "mid" | "bot";
export type SideBuildings = {
  towers: { lane: Lane; tier: 1 | 2 | 3; alive: boolean }[];
  ancient: { top: boolean; bottom: boolean };
  racks: { lane: Lane; ranged: boolean; melee: boolean }[];
};
export type EventActor = { name: string; hero: Entity };
export type MatchEvents = {
  firstBlood: { time: number; side: Side; killer: EventActor | null } | null;
  firstTower: { time: number; side: Side; killer: EventActor | null } | null;
  roshan: { radiant: number; dire: number; kills: { time: number; side: Side }[] };
  couriers: { radiant: number; dire: number; kills: { time: number; victimSide: Side; killer: Entity | null }[] };
};
// Вард на карте (зеркало Ward из lib/opendota.ts). x/y — доля карты 0..1 от левого-верхнего угла.
export type Ward = {
  side: Side;
  hero: Entity;
  type: "obs" | "sen";
  x: number;
  y: number;
  placed: number;
  left: number | null;
  killer: Entity | null;
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
  wards: Ward[];
};

export const fmt = (n: number) => n.toLocaleString("ru-RU");
export const kFmt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));
// Как kFmt, но с одним знаком после запятой (для чипов преимущества в шапке: «+27.8K»).
export const kFmt1 = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n));
export const clock = (sec: number) => {
  const s = Math.abs(sec);
  return `${sec < 0 ? "-" : ""}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
export const initials = (s: string) =>
  (s.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 3) || "?").toUpperCase();
export const pad = <T,>(arr: T[], n: number): (T | null)[] =>
  [...arr, ...Array(Math.max(0, n - arr.length)).fill(null)].slice(0, n);

// Округление вверх до «красивого» шага для подписей оси (5к/10к/25к…).
export function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const steps = [1, 2, 2.5, 5, 10];
  for (const s of steps) if (v <= s * pow) return s * pow;
  return 10 * pow;
}
