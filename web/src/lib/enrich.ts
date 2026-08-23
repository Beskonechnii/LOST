// Только сервер: обогащение черновика состава внешними данными — Steam и OpenDota.
//
// Отдельным шагом, а не побочным эффектом сохранения (TOURNAMENTS-PLAN.md §2.6): это сеть, а сеть
// внутри формы записи означает таймаут посреди заведения дюжины команд. Оператор жмёт «подтянуть»,
// результат ложится в черновик, запись потом идёт уже офлайн.
//
// Что умеем:
//   • именной адрес steamcommunity.com/id/<name> → account_id (Steam Web API, STEAM_API_KEY) —
//     единственное, что не разбирается на месте функцией accountIdFromUrl;
//   • профиль OpenDota по account_id → ранг, актуальный ник и аватар. Ранг сохраняем (Player.rank),
//     ник и аватар — только показываем: ник в лиге человек выбирает сам, а аватар Steam живёт по
//     чужой ссылке, тогда как Player.photo у нас всегда локальный файл (src/lib/uploads.ts).

import { accountIdFromUrl } from "./profiles";
import type { PlayerDraft, TeamDraft } from "./roster-import";

const STEAM64_BASE = BigInt("76561197960265728");

/** steamcommunity.com/id/<vanity> → vanity; остальные адреса нас здесь не касаются. */
export const vanityOf = (url: string | null | undefined): string | null =>
  url?.replace(/^https?:\/\//i, "").match(/^(?:www\.)?steamcommunity\.com\/id\/([^/?#]+)/i)?.[1] ?? null;

export async function resolveVanity(vanity: string): Promise<string | null> {
  const key = process.env.STEAM_API_KEY;
  if (!key) throw new Error("Нет STEAM_API_KEY в web/.env — именные ссылки Steam без него не разобрать");
  const url = new URL("https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/");
  url.searchParams.set("key", key);
  url.searchParams.set("vanityurl", vanity);
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (res.status === 403) throw new Error("Steam отклонил ключ (403). Проверьте STEAM_API_KEY.");
  if (!res.ok) throw new Error(`Steam ответил ${res.status}`);
  const json = (await res.json()) as { response?: { success?: number; steamid?: string } };
  // success=1 — нашли, 42 — такого имени нет; иных вариантов Valve не документирует.
  if (json.response?.success !== 1 || !json.response.steamid) return null;
  return String(BigInt(json.response.steamid) - STEAM64_BASE);
}

export type DotaProfile = { personaname: string | null; avatar: string | null; rank: number | null };

/** Профиль игрока в OpenDota. Нет такого id или сеть подвела — null, это не повод рушить разбор. */
export async function fetchDotaProfile(accountId: string): Promise<DotaProfile | null> {
  try {
    const res = await fetch(`https://api.opendota.com/api/players/${accountId}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      profile?: { personaname?: string; avatarfull?: string } | null;
      rank_tier?: number | null;
    };
    if (!json?.profile) return null;
    return {
      personaname: json.profile.personaname ?? null,
      avatar: json.profile.avatarfull ?? null,
      rank: json.rank_tier ?? null,
    };
  } catch {
    return null;
  }
}

/** Что удалось выяснить по игроку — строкой для отчёта оператору. */
export type EnrichNote = { nickname: string; text: string; level: "ok" | "warn" };

/**
 * Дотянуть данные по одной команде. Идём по игрокам последовательно: OpenDota ограничивает частоту,
 * и десяток параллельных запросов на состав — верный способ получить 429 вместо данных.
 */
export async function enrichTeam(team: TeamDraft): Promise<{ team: TeamDraft; notes: EnrichNote[] }> {
  const notes: EnrichNote[] = [];
  const players: PlayerDraft[] = [];

  for (const source of team.players) {
    const p: PlayerDraft = { ...source };

    // 1. id из ссылок, если парсер его не вывел (например, ссылка вида /profiles/<steam64>).
    if (!p.accountId) {
      for (const link of [p.dotabuffUrl, p.stratzUrl, p.steamUrl]) {
        if (!link) continue;
        p.accountId = accountIdFromUrl(link);
        if (p.accountId) break;
      }
    }

    // 2. Именной адрес Steam — только через Steam Web API.
    const vanity = p.accountId ? null : vanityOf(p.steamUrl);
    if (vanity) {
      try {
        const resolved = await resolveVanity(vanity);
        if (resolved) {
          p.accountId = resolved;
          notes.push({ nickname: p.nickname, text: `именная ссылка Steam разобрана → ${resolved}`, level: "ok" });
        } else {
          notes.push({ nickname: p.nickname, text: `Steam не знает имени «${vanity}»`, level: "warn" });
        }
      } catch (e) {
        notes.push({ nickname: p.nickname, text: e instanceof Error ? e.message : "Steam недоступен", level: "warn" });
      }
    }

    if (!p.accountId) {
      notes.push({ nickname: p.nickname, text: "нет ни id, ни разбираемой ссылки — обогащать нечего", level: "warn" });
      players.push(p);
      continue;
    }

    const profile = await fetchDotaProfile(p.accountId);
    if (!profile) {
      notes.push({ nickname: p.nickname, text: `OpenDota не отдала профиль ${p.accountId}`, level: "warn" });
      players.push(p);
      continue;
    }

    p.rank = profile.rank;
    p.dotaName = profile.personaname;
    p.avatar = profile.avatar;
    const bits = [profile.rank ? `ранг ${profile.rank}` : null, profile.personaname ? `в доте «${profile.personaname}»` : null]
      .filter(Boolean)
      .join(", ");
    notes.push({ nickname: p.nickname, text: bits || "профиль есть, но пустой", level: "ok" });
    players.push(p);
  }

  return { team: { ...team, players }, notes };
}

/** Обогатить пачку команд — последовательно, по той же причине, что и игроков внутри команды. */
export async function enrichTeams(teams: TeamDraft[]) {
  const out: TeamDraft[] = [];
  const notes: EnrichNote[] = [];
  for (const t of teams) {
    const res = await enrichTeam(t);
    out.push(res.team);
    notes.push(...res.notes);
  }
  return { teams: out, notes };
}
