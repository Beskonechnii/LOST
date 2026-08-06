// Генерирует web/src/lib/dota-constants.json — локальную копию справочников Доты.
// OpenDota отдаёт по /api/constants/* ровно содержимое репозитория odota/dotaconstants,
// поэтому берём его напрямую с GitHub: это снимает 7 из 8 запросов к их API на отчёт
// и переживает их аварии (522). Запуск: `node scripts/build-dota-constants.mjs`.
// Перезапускать при смене патча Доты.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "dota-constants.json");
const BASE = "https://raw.githubusercontent.com/odota/dotaconstants/master/build";

const getJson = async (name) => {
  const url = `${BASE}/${name}.json`;
  const r = await fetch(url, { headers: { "User-Agent": "LOST-constants-build/1.0" } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

// Файлы вендорятся не целиком: из items/abilities нам нужен только dname, из hero_abilities —
// только таланты. Иначе 2.8 МБ мусора (описания, атрибуты, картинки) поехали бы в репозиторий.
const pickDname = (src) => Object.fromEntries(Object.entries(src).map(([k, v]) => [k, { dname: v?.dname ?? "" }]));

async function main() {
  const [heroes, itemIds, items, abilityIds, abilities, heroAbilities, buffs] = await Promise.all([
    getJson("heroes"),
    getJson("item_ids"),
    getJson("items"),
    getJson("ability_ids"),
    getJson("abilities"),
    getJson("hero_abilities"),
    getJson("permanent_buffs"),
  ]);

  // heroes.json — объект по id, а /api/heroes отдаёт массив: приводим к форме, которую ждёт код.
  const heroList = Object.values(heroes).map((h) => ({
    id: h.id,
    name: h.name,
    localized_name: h.localized_name,
    // primary_attr: str|agi|int|all — нужен single draft (герой по каждой характеристике).
    primary_attr: h.primary_attr,
  }));
  const broken = heroList.filter((h) => !h.id || !h.name || !h.localized_name);
  if (broken.length) throw new Error(`Герои без обязательных полей: ${broken.length}`);

  const out = {
    // Дата сборки — чтобы по файлу было видно, насколько справочник свежий.
    builtAt: new Date().toISOString().slice(0, 10),
    heroes: heroList,
    itemIds,
    items: pickDname(items),
    abilityIds,
    abilities: pickDname(abilities),
    heroAbilities: Object.fromEntries(
      Object.entries(heroAbilities).map(([k, v]) => [k, { talents: v?.talents ?? [] }]),
    ),
    buffs,
  };

  writeFileSync(OUT, JSON.stringify(out) + "\n");
  const kb = (Buffer.byteLength(JSON.stringify(out)) / 1024).toFixed(0);
  console.log(`${OUT} — ${heroList.length} героев, ${Object.keys(itemIds).length} предметов, ${kb} КБ`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
