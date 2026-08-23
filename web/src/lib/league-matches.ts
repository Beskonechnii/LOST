// Только сервер: список матчей лиги по её `league_id` — чтобы id карт в архив не вводили руками.
//
// Разведка источников (23.08.2026), проверено на живой лиге LOST S2 div#1 (`league_id` 19700):
//
// - **OpenDota**, отдельный матч (`/api/matches/<id>`) — работает, на нём и стоит весь наш разбор.
//   Но список матчей лиги (`/api/leagues/<id>/matches`) для нас пуст: наша лига помечена у них
//   `tier: "excluded"`, а в таблицы про-матчей (и в explorer) попадают только турниры с тиром.
// - **Stratz** — знает матч и его `leagueId`, но саму лигу отдаёт как `null`: списка нет.
// - **Liquipedia** — страницы у лиги нашего размера нет; заводить её руками ради списка id дороже,
//   чем вводить эти id.
// - **Dotabuff** — страница лиги есть, но это скрейпинг под Cloudflare и против их правил.
// - **Steam Web API** (`IDOTA2Match_570/GetMatchHistory`) — официальный источник Valve, видит матчи
//   по тикету лиги независимо от тира. Единственный, который делает то, что нужно. Нужен
//   `STEAM_API_KEY` (бесплатный, steamcommunity.com/dev/apikey); без него запрос отдаёт 403.
//
// Поэтому источник здесь один — Steam, а `league_id` живёт у турнира.

import "server-only";

export type LeagueMatch = {
  matchId: string;
  startedAt: Date | null;
  /** Команды матча, как их знает Valve; у лобби без заявленных команд — null. */
  radiantName: string | null;
  direName: string | null;
};

export type LeagueMatchesResult =
  | { ok: true; matches: LeagueMatch[] }
  | { ok: false; error: string };

const STEAM_HISTORY = "https://api.steampowered.com/IDOTA2Match_570/GetMatchHistory/v1/";

type SteamMatch = {
  match_id: number;
  start_time: number;
  radiant_team_name?: string;
  dire_team_name?: string;
};

/**
 * Матчи лиги, свежие сверху. Ошибки возвращаем текстом, а не бросаем: оператор должен прочитать,
 * чего не хватает (обычно ключа), прямо на странице архива.
 */
export async function leagueMatches(leagueId: number): Promise<LeagueMatchesResult> {
  const key = (process.env.STEAM_API_KEY ?? "").trim();
  if (!key) {
    return {
      ok: false,
      error:
        "Нужен STEAM_API_KEY в web/.env — список матчей лиги отдаёт только Steam Web API " +
        "(ключ бесплатный: steamcommunity.com/dev/apikey). Без него id карт вводятся руками.",
    };
  }

  const url = `${STEAM_HISTORY}?key=${encodeURIComponent(key)}&league_id=${leagueId}&matches_requested=100`;
  let payload: { result?: { status?: number; statusDetail?: string; matches?: SteamMatch[] } };
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { ok: false, error: `Steam ответил ${res.status} — проверьте ключ и league_id` };
    payload = await res.json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не удалось сходить в Steam" };
  }

  const result = payload.result;
  // У Valve ошибка приезжает не кодом ответа, а полем внутри 200: status 1 — всё хорошо.
  if (!result || (result.status !== undefined && result.status !== 1)) {
    return { ok: false, error: result?.statusDetail ?? "Steam не отдал матчи этой лиги" };
  }

  const matches = (result.matches ?? []).map((m) => ({
    matchId: String(m.match_id),
    startedAt: m.start_time ? new Date(m.start_time * 1000) : null,
    radiantName: m.radiant_team_name || null,
    direName: m.dire_team_name || null,
  }));
  matches.sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0));
  return { ok: true, matches };
}
