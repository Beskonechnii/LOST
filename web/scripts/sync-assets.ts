// Синк ассетов Dota 2 (герои / предметы / способности) из констант OpenDota в public/assets.
// Источник имён-путей — constants/*, сами PNG — Steam CDN. Имя файла = слаг (стабильный ключ),
// тот же, что отдаёт сервер в отчёте (src/lib/opendota.ts) и ждёт резолвер (src/lib/assets.ts).
//
// Запуск (из web/):  npx tsx scripts/sync-assets.ts
//   --force   перекачать уже существующие файлы
//   --heroes --items --abilities   ограничить набор (по умолчанию — все три)
//
// Идемпотентно: по умолчанию пропускает уже скачанное. На новом патче Dota просто прогони снова.

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OD = "https://api.opendota.com/api/constants";
const CDN = "https://cdn.cloudflare.steamstatic.com";

const here = path.dirname(fileURLToPath(import.meta.url)); // web/scripts
const assetsDir = path.resolve(here, "../public/assets");

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const only = ["heroes", "items", "abilities"].filter((k) => args.has(`--${k}`));
const kinds = only.length ? only : ["heroes", "items", "abilities"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const heroSlug = (name: string) => name.replace(/^npc_dota_hero_/, "");
const cdnUrl = (img: string) => CDN + img.split("?")[0]; // отрезаем ?t=… — CDN отдаёт и без него

type Job = { kind: string; slug: string; url: string };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenDota ${res.status} ${url}`);
  return res.json() as Promise<T>;
}

// Собираем список работ из констант. Слаг = имя файла; берём только записи с картинкой.
async function buildJobs(): Promise<Job[]> {
  const jobs: Job[] = [];

  if (kinds.includes("heroes")) {
    const heroes = await getJson<Record<string, { name: string; img?: string }>>(`${OD}/heroes`);
    for (const h of Object.values(heroes)) {
      if (h.img) jobs.push({ kind: "heroes", slug: heroSlug(h.name), url: cdnUrl(h.img) });
    }
  }
  if (kinds.includes("items")) {
    const items = await getJson<Record<string, { img?: string }>>(`${OD}/items`);
    for (const [slug, v] of Object.entries(items)) {
      if (v.img) jobs.push({ kind: "items", slug, url: cdnUrl(v.img) });
    }
  }
  if (kinds.includes("abilities")) {
    const abilities = await getJson<Record<string, { img?: string }>>(`${OD}/abilities`);
    for (const [slug, v] of Object.entries(abilities)) {
      if (v.img) jobs.push({ kind: "abilities", slug, url: cdnUrl(v.img) });
    }
  }
  return jobs;
}

// missing = 404 (константа ссылается на картинку, которой у Valve нет — не сбой);
// fail = сеть/5xx (настоящая проблема, влияет на exit-код).
async function download(url: string, dest: string, tries = 3): Promise<"ok" | "skip" | "missing" | "fail"> {
  if (!force && existsSync(dest)) return "skip";
  for (let t = 1; t <= tries; t++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return "missing";
      if (!res.ok) throw new Error(String(res.status));
      await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
      return "ok";
    } catch (e) {
      if (t === tries) {
        console.warn(`  ✗ ${path.basename(dest)} ← ${url} (${e})`);
        return "fail";
      }
      await sleep(300 * t);
    }
  }
  return "fail";
}

// Простой пул воркеров — не заваливаем CDN.
async function pool<T>(items: T[], n: number, worker: (t: T, i: number) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++;
        await worker(items[idx], idx);
      }
    }),
  );
}

async function main() {
  console.log(`Синк ассетов: ${kinds.join(", ")}${force ? " (force)" : ""}`);
  for (const k of kinds) await fs.mkdir(path.join(assetsDir, k), { recursive: true });

  const jobs = await buildJobs();
  console.log(`Задач: ${jobs.length}. Качаю в ${assetsDir}\n`);

  const stat = { ok: 0, skip: 0, missing: 0, fail: 0 };
  let done = 0;
  await pool(jobs, 8, async (j) => {
    const dest = path.join(assetsDir, j.kind, `${j.slug}.png`);
    const r = await download(j.url, dest);
    stat[r]++;
    if (++done % 100 === 0) console.log(`  …${done}/${jobs.length}`);
  });

  const byKind = (k: string) => jobs.filter((j) => j.kind === k).map((j) => j.slug).sort();
  const manifest = {
    generatedAt: new Date().toISOString(),
    source: "OpenDota constants + Steam CDN (dota_react)",
    counts: Object.fromEntries(kinds.map((k) => [k, byKind(k).length])),
    slugs: Object.fromEntries(kinds.map((k) => [k, byKind(k)])),
  };
  await fs.writeFile(path.join(assetsDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(
    `\nГотово: ${stat.ok} скачано, ${stat.skip} пропущено, ${stat.missing} нет на CDN, ${stat.fail} ошибок.`,
  );
  console.log(`Манифест: public/assets/manifest.json`);
  if (stat.fail) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
