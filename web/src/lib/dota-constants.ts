// Локальная копия справочников Доты (герои, предметы, способности, таланты, баффы).
// Собирается `node scripts/build-dota-constants.mjs` из odota/dotaconstants — того самого
// репозитория, содержимое которого OpenDota отдаёт по /api/constants/*.
//
// Зачем: справочники меняются раз в патч, а мы дёргали их по сети на каждый холодный процесс —
// 7 запросов из 8 и полная зависимость от доступности OpenDota (её 522 роняли весь отчёт).
// Здесь только справочники; сам матч всё так же берётся из API — он локальным быть не может.

import raw from "./dota-constants.json";

export type LocalHero = { id: number; name: string; localized_name: string };
export type LocalConstants = {
  itemIds: Record<string, string>;
  items: Record<string, { dname?: string }>;
  abilityIds: Record<string, string>;
  abilities: Record<string, { dname?: string }>;
  heroAbilities: Record<string, { talents?: { name: string; level: number }[] }>;
  buffs: Record<string, string>;
};

const data = raw as unknown as LocalConstants & { builtAt: string; heroes: LocalHero[] };

// Дата сборки справочника — пригодится, когда «почему нет нового предмета» станет вопросом.
export const constantsBuiltAt = data.builtAt;

export const localHeroes = (): LocalHero[] => data.heroes;

export const localConstants = (): LocalConstants => ({
  itemIds: data.itemIds,
  items: data.items,
  abilityIds: data.abilityIds,
  abilities: data.abilities,
  heroAbilities: data.heroAbilities,
  buffs: data.buffs,
});
