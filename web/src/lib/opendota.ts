// OpenDota: тянем стату матча. Ключ не нужен. Детальные поля (hero_damage, camps_stacked)
// есть только у распарсенных матчей (иначе — нули).

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

export type OdMatch = {
  matchId: string;
  radiantWin: boolean;
  players: OdPlayerStat[];
};

export async function fetchOpenDotaMatch(matchId: string): Promise<OdMatch> {
  const res = await fetch(`https://api.opendota.com/api/matches/${matchId}`);
  if (!res.ok) throw new Error(`OpenDota ${res.status} for match ${matchId}`);
  const m = await res.json();
  return {
    matchId: String(m.match_id),
    radiantWin: !!m.radiant_win,
    players: (m.players ?? [])
      .filter((p: { account_id: number | null }) => p.account_id != null)
      .map((p: Record<string, number>) => ({
        accountId: p.account_id,
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

// Композитный скор для авто-подсказки MVP (веса подберём позже).
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

// --- Просмотр матча по id (каркас: вставил id → верная стата) ---

let heroCache: Map<number, string> | null = null;
async function heroNames(): Promise<Map<number, string>> {
  if (heroCache) return heroCache;
  const res = await fetch("https://api.opendota.com/api/heroes");
  if (!res.ok) throw new Error(`OpenDota heroes ${res.status}`);
  const arr: { id: number; localized_name: string }[] = await res.json();
  heroCache = new Map(arr.map((h) => [h.id, h.localized_name]));
  return heroCache;
}

export type MatchPlayerView = {
  side: "radiant" | "dire";
  name: string;
  hero: string;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  netWorth: number;
};

export type MatchView = {
  matchId: string;
  radiantWin: boolean;
  radiantTeam: string | null; // имя команды из OpenDota (для про-матчей); в UI можно переопределить
  direTeam: string | null;
  players: MatchPlayerView[];
};

export async function fetchMatchView(matchId: string): Promise<MatchView> {
  const [mRes, heroes] = await Promise.all([
    fetch(`https://api.opendota.com/api/matches/${matchId}`),
    heroNames(),
  ]);
  if (!mRes.ok) throw new Error(`OpenDota ${mRes.status} для матча ${matchId}`);
  const m = await mRes.json();
  if (!m || !Array.isArray(m.players) || m.players.length === 0) {
    throw new Error(`Матч ${matchId} не найден или без данных`);
  }

  const players: MatchPlayerView[] = m.players.map((p: Record<string, unknown>) => ({
    side: p.isRadiant ? "radiant" : "dire",
    name: (p.name as string) || (p.personaname as string) || "Аноним",
    hero: heroes.get(p.hero_id as number) ?? `Hero ${p.hero_id}`,
    level: (p.level as number) ?? 0,
    kills: (p.kills as number) ?? 0,
    deaths: (p.deaths as number) ?? 0,
    assists: (p.assists as number) ?? 0,
    netWorth: (p.net_worth as number) ?? 0,
  }));

  return {
    matchId: String(m.match_id),
    radiantWin: !!m.radiant_win,
    radiantTeam: m.radiant_team?.name ?? null,
    direTeam: m.dire_team?.name ?? null,
    players,
  };
}
