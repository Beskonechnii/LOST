// Единый слой ассетов. Здесь — и только здесь — решается, откуда берётся картинка.
// Стратегия проекта: полностью локально (public/assets), имя файла = слаг.
// Слаги приходят с сервера в отчёте (opendota.ts) и совпадают с тем, что качает scripts/sync-assets.ts.
//
// Улучшить арт  → положить свой PNG под тем же именем в public/assets/<kind>/<slug>.png.
// Добавить своё → новый файл + ссылка по слагу.

export type AssetKind = "heroes" | "items" | "abilities";

const STEAM_CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react";

/** Локальный путь к иконке (основной источник). */
export function assetUrl(kind: AssetKind, slug: string): string {
  return `/assets/${kind}/${slug}.png`;
}

/** Запасной URL на CDN Valve — если локальный файл ещё не свендорен (onError в иконке). */
export function assetFallback(kind: AssetKind, slug: string): string {
  return `${STEAM_CDN}/${kind}/${slug}.png`;
}

export const heroImg = (slug: string) => assetUrl("heroes", slug);
export const itemImg = (slug: string) => assetUrl("items", slug);
export const abilityImg = (slug: string) => assetUrl("abilities", slug);
