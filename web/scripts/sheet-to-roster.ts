// Разбор гугл-таблицы составов → data/roster.json (дальше заливает scripts/import-roster.ts).
//
// Запуск (из web/):
//   npx tsx scripts/sheet-to-roster.ts --sheet <id или ссылка> --only moloko,remix --alias "300$=300-dollars"
//     --sheet   ссылка на таблицу / её id / путь к локальному .xlsx
//     --only    какие команды взять (слаги через запятую); по умолчанию — все
//     --div     только один дивизион («1» → вкладка «Команды 1 div»)
//     --alias   слаг для команд, у которых он не выводится из названия («300$=300-dollars»; несколько — через ;)
//     --out     другой файл вместо data/roster.json
//     --dry     показать результат, не записывая файл
//
// Почему xlsx, а не CSV: ссылки на профили в таблице — это гиперссылки ячеек, в CSV-экспорт они не
// попадают. В xlsx они лежат в _rels листа, оттуда достаём account_id из адресов вида
// dotabuff.com/players/<id>. Ссылки на что угодно другое игнорируем — тогда accountId остаётся пустым.
//
// Формат листа (сезон S2): блок команды начинается строкой «<№> | <Название (ТЕГ)>», дальше шапка
// «Роль | ИНФ | MMR | …» и строки игроков: роль 1–5 → carry…hard-support, «Тренер» → coach,
// пустая роль → standin. Имя игрока — «Имя "Ник" Фамилия».

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync, strFromU8 } from "fflate";
import { slugify } from "../src/lib/profiles";
import { roleByPosition, type RoleKey } from "../src/lib/roles";

type Player = {
  slug: string;
  nickname: string;
  realName: string | null;
  role: RoleKey | null;
  mmr: number | null;
  accountId: string | null;
  dotabuffUrl: string | null;
};
type Team = { slug: string; name: string; tag?: string | null; group?: string | null; players: Player[] };

const here = path.dirname(fileURLToPath(import.meta.url)); // web/scripts
const args = process.argv.slice(2);
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const dry = args.includes("--dry");
const source = arg("--sheet");
const only = arg("--only")?.split(",").map((s) => s.trim()).filter(Boolean);
const divFilter = arg("--div"); // «1» — брать только вкладку «Команды 1 div»
const outFile = path.resolve(here, "..", arg("--out") ?? "data/roster.json");

const aliases = new Map(
  (arg("--alias") ?? "")
    .split(";")
    .filter(Boolean)
    .map((pair) => {
      const [from, to] = pair.split("=");
      return [from.trim().toLowerCase(), to.trim()];
    }),
);

if (!source) {
  console.error('Укажите таблицу: --sheet "<ссылка, id или путь к .xlsx>"');
  process.exit(1);
}

// ── xlsx ─────────────────────────────────────────────────────────────────────
// Читаем минимум: общие строки, значения ячеек и гиперссылки. Полноценный парсер не нужен.

type Cell = { text: string; href: string | null };
type Grid = Cell[][]; // [строка][колонка]

const unescapeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");

/** «B12» → { row: 11, col: 1 } (нумерация с нуля). */
function refToRc(ref: string) {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(m[2]) - 1, col: col - 1 };
}

function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((si) =>
    [...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => unescapeXml(t[1])).join(""),
  );
}

function parseSheet(xml: string, shared: string[], rels: Map<string, string>): Grid {
  // ref → внешний адрес гиперссылки
  const links = new Map<string, string>();
  for (const h of xml.matchAll(/<hyperlink[^>]*\/>/g)) {
    const ref = h[0].match(/ref="([^"]+)"/)?.[1];
    const rid = h[0].match(/r:id="([^"]+)"/)?.[1];
    const target = rid ? rels.get(rid) : undefined;
    if (ref && target) links.set(ref.split(":")[0], target);
  }

  const grid: Grid = [];
  // пустые ячейки самозакрыты (<c r="A2" s="2"/>) — их нужно отличать от <c …>…</c>,
  // иначе «жадный» разбор съедает соседнюю ячейку и колонки уезжают
  for (const c of xml.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = c[1];
    const ref = attrs.match(/r="([^"]+)"/)?.[1];
    const rc = ref ? refToRc(ref) : null;
    if (!rc) continue;

    const type = attrs.match(/t="([^"]+)"/)?.[1];
    const body = c[2] ?? "";
    const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
    const inline = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => unescapeXml(t[1])).join("");
    const text = type === "s" ? (shared[Number(raw)] ?? "") : type === "inlineStr" ? inline : unescapeXml(raw);

    (grid[rc.row] ??= [])[rc.col] = { text: text.trim(), href: links.get(ref!) ?? null };
  }
  return grid;
}

/** Листы книги с их названиями — по названию понимаем дивизион («Команды 1 div»). */
function readWorkbook(buf: Uint8Array): { name: string; grid: Grid }[] {
  const files = unzipSync(buf);
  const shared = files["xl/sharedStrings.xml"] ? parseSharedStrings(strFromU8(files["xl/sharedStrings.xml"])) : [];

  // порядок <sheet> в workbook.xml = порядок вкладок; rId → файл листа
  const wbRels = new Map<string, string>();
  for (const r of strFromU8(files["xl/_rels/workbook.xml.rels"]).matchAll(/<Relationship([^>]*)\/>/g)) {
    const id = r[1].match(/Id="([^"]+)"/)?.[1];
    const target = r[1].match(/Target="([^"]+)"/)?.[1];
    if (id && target) wbRels.set(id, target.replace(/^\/?xl\//, ""));
  }

  const out: { name: string; grid: Grid }[] = [];
  for (const s of strFromU8(files["xl/workbook.xml"]).matchAll(/<sheet\s([^>]*)\/?>/g)) {
    const name = unescapeXml(s[1].match(/name="([^"]+)"/)?.[1] ?? "");
    const file = `xl/${wbRels.get(s[1].match(/r:id="([^"]+)"/)?.[1] ?? "") ?? ""}`;
    if (!files[file]) continue;

    const relFile = files[file.replace("worksheets/", "worksheets/_rels/") + ".rels"];
    const rels = new Map<string, string>();
    if (relFile) {
      for (const r of strFromU8(relFile).matchAll(/<Relationship([^>]*)\/>/g)) {
        const id = r[1].match(/Id="([^"]+)"/)?.[1];
        const target = r[1].match(/Target="([^"]+)"/)?.[1];
        if (id && target) rels.set(id, unescapeXml(target));
      }
    }
    out.push({ name, grid: parseSheet(strFromU8(files[file]), shared, rels) });
  }
  return out;
}

// ── разбор составов ──────────────────────────────────────────────────────────

/** «Название (ТЕГ)» → имя и тег. */
function splitName(raw: string) {
  const m = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { name: m[1].trim(), tag: m[2].trim() } : { name: raw.trim(), tag: null };
}

/** «Имя "Ник" Фамилия» → ник и настоящее имя. */
function splitPlayer(raw: string) {
  const m = raw.match(/^(.*?)"([^"]+)"(.*)$/);
  if (!m) return null;
  const nickname = m[2].trim();
  if (!nickname) return null;
  return { nickname, realName: `${m[1].trim()} ${m[3].trim()}`.replace(/\s+/g, " ").trim() || null };
}

/** account_id из ссылки на Dotabuff; любые другие ссылки не подходят. */
const accountIdFrom = (href: string | null) =>
  href?.match(/dotabuff\.com\/players\/(\d+)/i)?.[1] ?? null;

const teamSlug = (name: string) => aliases.get(name.toLowerCase()) ?? slugify(name);

/**
 * Таблица главнее по составу и ролям, но пустой ячейкой не затирает то, что проставили руками:
 * account_id, добытый не из таблицы, должен пережить следующий разбор.
 */
function mergePlayer(prev: Player | undefined, next: Player): Player {
  if (!prev) return next;
  return {
    ...prev,
    ...next,
    accountId: next.accountId ?? prev.accountId ?? null,
    dotabuffUrl: next.dotabuffUrl ?? prev.dotabuffUrl ?? null,
    mmr: next.mmr ?? prev.mmr ?? null,
  };
}

/** Числа в xlsx хранятся как «1.0» — приводим к «1», чтобы сравнивать с ролями и номерами. */
const asInt = (s: string) => (/^\d+(\.0+)?$/.test(s) ? String(Number(s)) : s);

function parseRoster(grid: Grid, group: string | null = null): Team[] {
  const teams: Team[] = [];
  let current: Team | null = null;

  for (const row of grid) {
    if (!row) continue;
    const cell = (i: number) => asInt(row[i]?.text ?? "");

    // начало блока: во второй колонке номер команды, в четвёртой — её название (не число)
    if (/^\d+$/.test(cell(1)) && cell(3) && !/^\d+$/.test(cell(3))) {
      const { name, tag } = splitName(cell(3));
      current = { slug: teamSlug(name), name, tag, group, players: [] };
      teams.push(current);
      continue;
    }
    if (!current) continue;

    const role = cell(3);
    if (role === "Роль") continue; // шапка блока

    const parsed = cell(4) ? splitPlayer(cell(4)) : null;
    if (!parsed) continue;

    const linkCell = row.find((c) => c?.href && /dotabuff\.com\/players\/\d+/i.test(c.href));
    const mmr = Number(cell(6));
    current.players.push({
      slug: slugify(parsed.nickname),
      nickname: parsed.nickname,
      realName: parsed.realName,
      mmr: Number.isFinite(mmr) && mmr > 0 ? mmr : null, // у тренеров колонка пустая
      // роль пишут по-разному («Тренер», «ТРЕНЕР») — регистр не должен решать, тренер человек или замена
      role: /^[1-5]$/.test(role) ? roleByPosition(Number(role)) : role.toLowerCase() === "тренер" ? "coach" : "standin",
      accountId: accountIdFrom(linkCell?.href ?? null),
      dotabuffUrl: linkCell?.href ?? null,
    });
  }
  return teams;
}

async function loadTeams(src: string): Promise<Team[]> {
  let buf: Uint8Array;
  if (/\.xlsx$/i.test(src) && !/^https?:/.test(src)) {
    buf = new Uint8Array(await fs.readFile(path.resolve(src)));
  } else {
    const id = src.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1] ?? src;
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`);
    if (!res.ok) throw new Error(`Не скачать таблицу (${res.status}). Открыт ли доступ по ссылке?`);
    buf = new Uint8Array(await res.arrayBuffer());
  }

  // Составы лежат на вкладках «Команды N div» — оттуда же берём дивизион команды.
  const teams: Team[] = [];
  for (const sheet of readWorkbook(buf)) {
    if (!/команды/i.test(sheet.name)) continue;
    const div = sheet.name.match(/(\d+)\s*div/i)?.[1];
    if (divFilter && div !== divFilter) continue;
    const parsed = parseRoster(sheet.grid, div ? `Division ${div}` : null);
    console.log(`лист «${sheet.name}»: ${parsed.length} команд(ы)`);
    teams.push(...parsed);
  }

  // Одинаковые названия в разных дивизионах — это разные команды. Первая (обычно div 1)
  // оставляет слаг себе, остальным добавляем суффикс дивизиона: remix → remix-d2.
  const seen = new Set<string>();
  for (const t of teams) {
    if (!seen.has(t.slug)) {
      seen.add(t.slug);
      continue;
    }
    const div = t.group?.match(/(\d+)/)?.[1];
    const slug = div ? `${t.slug}-d${div}` : `${t.slug}-2`;
    console.log(`  «${t.name}» из ${t.group ?? "другого дивизиона"} — отдельная команда, слаг ${slug}`);
    t.slug = slug;
    seen.add(slug);
  }
  if (teams.length === 0) throw new Error("Не нашлось вкладок «Команды …» с составами в ожидаемом формате");
  return teams;
}

async function main() {
  const parsed = await loadTeams(source!);
  const picked = only ? parsed.filter((t) => only.includes(t.slug)) : parsed;

  if (only) {
    const missing = only.filter((s) => !parsed.some((t) => t.slug === s));
    if (missing.length) {
      console.log(`⚠ не нашлось в таблице: ${missing.join(", ")}`);
      console.log(`  доступные слаги: ${parsed.map((t) => t.slug).join(", ")}`);
    }
  }

  // Мержим в существующий roster.json: команды из таблицы перекрывают одноимённые по слагу.
  const existing = JSON.parse(await fs.readFile(outFile, "utf8").catch(() => "[]")) as Team[];
  const bySlug = new Map(existing.map((t) => [t.slug, t]));
  for (const t of picked) {
    const prev = bySlug.get(t.slug);
    bySlug.set(t.slug, {
      ...prev,
      ...t,
      tag: t.tag ?? prev?.tag ?? null,
      players: t.players.map((p) => mergePlayer(prev?.players?.find((x) => x.slug === p.slug), p)),
    });
  }

  // Таблица — источник истины по составам, поэтому команду, которой в ней больше нет, надо убрать
  // из файла, а не оставлять навсегда: иначе переименование или смена слага плодит команду-дубль
  // (так и появился «300-dollars» рядом с «300»). Чистим только те дивизионы, что реально разобрали,
  // и только когда взяли таблицу целиком — при --only мы про остальные команды ничего не знаем.
  if (!only) {
    const scannedGroups = new Set(parsed.map((t) => t.group ?? "—"));
    const fromSheet = new Set(picked.map((t) => t.slug));
    for (const t of [...bySlug.values()]) {
      if (fromSheet.has(t.slug) || !scannedGroups.has(t.group ?? "—")) continue;
      bySlug.delete(t.slug);
      console.log(`  убрал из файла: ${t.slug} — «${t.name}» больше нет в таблице`);
    }
  }

  let noId = 0;
  for (const t of picked) {
    const ids = t.players.filter((p) => p.accountId).length;
    noId += t.players.length - ids;
    console.log(`${t.slug} — ${t.name}: ${t.players.length} игрок(ов), account_id у ${ids}`);
    for (const p of t.players) {
      const mmr = p.mmr ? ` · ${p.mmr} MMR` : "";
      console.log(`   ${(p.role ?? "—").padEnd(13)} ${p.nickname}${p.accountId ? ` · ${p.accountId}` : ""}${mmr}`);
    }
  }
  if (noId) console.log(`\n⚠ без account_id: ${noId} — в таблице у них ссылка не на Dotabuff (или её нет)`);

  const dupes = picked.flatMap((t) => t.players.map((p) => p.slug)).filter((s, i, all) => all.indexOf(s) !== i);
  if (dupes.length) console.log(`⚠ одинаковые слаги игроков: ${[...new Set(dupes)].join(", ")} — развести вручную`);

  if (dry) {
    console.log("\n--dry: файл не тронут");
    return;
  }
  await fs.writeFile(outFile, `${JSON.stringify([...bySlug.values()], null, 2)}\n`, "utf8");
  console.log(`\nЗаписано в ${path.relative(process.cwd(), outFile)}: ${bySlug.size} команд(ы)`);
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
});
