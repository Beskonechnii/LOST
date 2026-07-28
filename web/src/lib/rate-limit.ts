// Только сервер: лимит частоты по IP для запросов, которые уходят наружу.
//
// Зачем. Публичный разбор матча ходит в OpenDota, а её лимит (~60 запросов в минуту) общий на всех
// пользователей интернета. Один скрипт, перебирающий id матчей через наш сервер, сожжёт его целиком
// и заодно подставит STEAM_API_KEY. Поэтому наружу пускаем считанное число запросов с одного IP.
//
// Считаем только промахи кэша: отдача с полки ничего не стоит и лимит не расходует — популярная
// ссылка на отчёт должна открываться у всех и всегда (см. lib/match-cache.ts).
//
// Счётчик живёт в памяти процесса: приложение одно и на одной машине (DEPLOY.md), заводить ради
// лимита Redis незачем. Цена — рестарт обнуляет окно; для защиты от перебора это не важно.

const WINDOW_MS = 60_000;
const LIMIT = 10; // запросов наружу в минуту с одного IP: человеку с запасом, скрипту — нет

const hits = new Map<string, number[]>();

/**
 * IP клиента. За обратным прокси (в проде — Caddy, см. DEPLOY.md) настоящий адрес приходит
 * заголовком; берём первый хоп. Заголовок подделывается кем угодно, поэтому годится он ровно
 * для лимита, а не для доступа: подменивший его получит другое окно, но не чужие права.
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || "local";
}

export type RateVerdict = { ok: true } | { ok: false; retryAfterSec: number };

/**
 * Занять слот в окне. Вызывать перед самым походом наружу — иначе лимит съедят ответы из кэша.
 */
export function takeSlot(ip: string): RateVerdict {
  const now = Date.now();
  const fresh = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  if (fresh.length >= LIMIT) {
    hits.set(ip, fresh);
    return { ok: false, retryAfterSec: Math.ceil((WINDOW_MS - (now - fresh[0])) / 1000) };
  }

  fresh.push(now);
  hits.set(ip, fresh);

  // Уборка прицепом к запросу: отдельный таймер держал бы процесс живым и в дев-режиме
  // перезапускался бы на каждой перекомпиляции. Карта маленькая, обход дешёвый.
  if (hits.size > 1000) {
    for (const [key, times] of hits) if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
  }

  return { ok: true };
}
