// Генерирует web/src/lib/talents.json — карту { talent_key -> полное описание }.
// Значения талантов ({s:...}) не приходят в константах OpenDota (нет чисел ~59%),
// поэтому тянем уже отрендеренное дерево талантов с Dota 2 Wiki (значения подставлены)
// и раскладываем по ключам из hero_abilities. Запуск: `node scripts/build-talents.mjs`.
// Перезапускать при смене патча.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "talents.json");
const OD = "https://api.opendota.com/api";
const WIKI = "https://dota2.fandom.com/api.php";

// Имена страниц вики, отличающиеся от localized_name OpenDota (заполняем по факту 404).
const WIKI_NAME = {};

const getJson = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": "LOST-talents-build/1.0" } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Достаём {10:{left,right},15,20,25} из отрендеренного HTML страницы <Hero>/Talents.
function parseTalentTree(htmlText) {
  const i = htmlText.indexOf("Hero Talents");
  if (i < 0) return null;
  const seg = htmlText.slice(i);
  const stripCell = (td) =>
    td
      .replace(/<span class="image-link"[\s\S]*?<\/span>/g, "") // иконка таланта
      .replace(/<[^>]+>/g, " ")
      .replace(/&#160;|&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
      .replace(/\s+/g, " ")
      .trim();
  const tiers = {};
  const rows = seg.match(/<tr>[\s\S]*?<\/tr>/g) ?? [];
  for (const row of rows) {
    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    const th = row.match(/<th[^>]*>([\s\S]*?)<\/th>/);
    if (tds.length === 2 && th) {
      const lvl = th[1].replace(/<[^>]+>/g, "").replace(/\s+/g, "");
      if (/^(10|15|20|25)$/.test(lvl)) tiers[lvl] = { left: stripCell(tds[0]), right: stripCell(tds[1]) };
    }
  }
  return Object.keys(tiers).length === 4 ? tiers : null;
}

async function main() {
  const [heroes, heroAbilities] = await Promise.all([
    getJson(`${OD}/heroes`),
    getJson(`${OD}/constants/hero_abilities`),
  ]);

  const out = {};
  const failed = [];
  for (const h of heroes) {
    const npc = h.name; // npc_dota_hero_lina
    const ha = heroAbilities[npc];
    if (!ha?.talents?.length) continue;
    const page = WIKI_NAME[npc] ?? h.localized_name;
    let tiers = null;
    try {
      const j = await getJson(
        `${WIKI}?action=parse&page=${encodeURIComponent(page)}/Talents&prop=text&format=json&disablelimitreport=1&redirects=1`,
      );
      tiers = parseTalentTree(j.parse?.text?.["*"] ?? "");
    } catch {
      /* 404 / нет страницы */
    }
    if (!tiers) {
      failed.push(`${h.localized_name} (${page})`);
      await sleep(120);
      continue;
    }
    // Ключи по ярусам: пара [0]=правый, [1]=левый (см. opendota.ts).
    const byTier = {};
    for (const t of ha.talents) (byTier[t.level] ??= []).push(t.name);
    for (const lvlField of [1, 2, 3, 4]) {
      const pair = byTier[lvlField];
      const heroLevel = String(lvlField * 5 + 5);
      const tier = tiers[heroLevel];
      if (!pair || !tier) continue;
      if (pair[0] && tier.right) out[pair[0]] = tier.right;
      if (pair[1] && tier.left) out[pair[1]] = tier.left;
    }
    process.stdout.write(".");
    await sleep(120);
  }

  writeFileSync(OUT, JSON.stringify(out, Object.keys(out).sort(), 2) + "\n");
  console.log(`\nЗаписано ${Object.keys(out).length} талантов → ${OUT}`);
  if (failed.length) console.log(`Без вики-страницы (${failed.length}):\n  ` + failed.join("\n  "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
