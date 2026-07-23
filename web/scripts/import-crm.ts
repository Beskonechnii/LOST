// Анкеты игроков из CRM лиги → БД: телеграм, дата рождения, город/страна, account_id.
//
// Запуск (из web/):
//   npx tsx scripts/import-crm.ts --file "<путь к .xlsx / .csv / .json>" [--dry]
//   npx tsx scripts/import-crm.ts --sheet "<ссылка на гугл-таблицу>" [--tab "Игроки"] [--dry]
//     --file    локальная выгрузка: .xlsx, .csv (; , или tab) либо .json (массив объектов)
//     --sheet   ссылка на гугл-таблицу или её id (скачивается как xlsx — ради гиперссылок)
//     --tab     какую вкладку читать; по умолчанию — первая, где нашлась шапка с ником
//     --force   перезаписывать уже заполненные поля (по умолчанию трогаем только пустые)
//     --dry     показать, что изменится, и не писать в базу
//
// Новых игроков скрипт НЕ заводит: в CRM вся лига за все сезоны, а в базе — текущий Division 1.
// Кого не нашли — печатаем списком, чтобы завести руками там, где это осмысленно.
//
// Сведение: по account_id, иначе по слагу ника, иначе по нику без регистра. Слаг — тот же,
// что и везде в проекте (src/lib/profiles.ts), поэтому «CHIPOLLINO» и «chipollino» сойдутся.

import fs from "node:fs/promises";
import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { loadWorkbook, type Grid } from "./xlsx";
import { accountIdFromUrl, normalizeTelegram, parseBirthday, slugify } from "../src/lib/profiles";

const args = process.argv.slice(2);
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const dry = args.includes("--dry");
const force = args.includes("--force");
const file = arg("--file");
const sheet = arg("--sheet");
const tab = arg("--tab");

if (!file && !sheet) {
  console.error('Укажите источник: --file "<выгрузка>" или --sheet "<ссылка на таблицу>"');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

// ── шапка таблицы ────────────────────────────────────────────────────────────
// Колонки в выгрузках CRM называют по-разному, поэтому ищем по подстрокам, а не по точному имени.

type Field = "nickname" | "realName" | "lastName" | "telegram" | "birthday" | "city" | "country" | "accountId" | "link";

const HEADERS: [Field, RegExp][] = [
  ["nickname", /^ник|nick|псевдоним/i],
  ["lastName", /фамилия|surname|last.?name/i],
  ["realName", /^имя|фио|first.?name|^name/i],
  ["telegram", /телеграм|telegram|\btg\b|\bтг\b|tg@/i],
  ["birthday", /рожден|день\s*рожд|\bдр\b|birth|\bdob\b/i],
  ["city", /город|city|прожива|населённ|населен/i],
  ["country", /стран|country/i],
  ["accountId", /account.?id|dota.?id|steam.?32/i],
  ["link", /steam|стим|dotabuff|stratz|opendota|main\s*db|профил|ссылк|link|profile/i],
];

/** Заголовок ячейки → поле анкеты. Порядок HEADERS важен: «account_id» проверяется раньше «ссылки». */
function fieldOf(header: string): Field | null {
  const h = header.trim();
  if (!h) return null;
  for (const [field, re] of HEADERS) if (re.test(h)) return field;
  return null;
}

type Row = Partial<Record<Exclude<Field, "link">, string>> & { links: string[] };

/**
 * Строка таблицы → анкета. Ссылочных колонок в CRM несколько (Steam, STEAM 2, Main DB, ЛС на сайте),
 * поэтому собираем их все: id вытащим из первой, которая на профиль, а не на сайт лиги.
 */
function toRows(header: string[], body: { text: string; href?: string | null }[][]): Row[] {
  const map = header.map(fieldOf);
  if (!map.includes("nickname")) {
    throw new Error(`Не нашёл колонку с ником. Колонки: ${header.filter(Boolean).join(" | ")}`);
  }

  return body
    .map((cells) => {
      const row: Row = { links: [] };
      map.forEach((field, i) => {
        const cell = cells[i];
        if (!field || !cell) return;
        // ссылка может быть и гиперссылкой ячейки, и просто текстом
        const link = cell.href || (/^https?:\/\//i.test(cell.text) ? cell.text : "");
        if (field === "link") {
          if (link) row.links.push(link);
        } else {
          row[field] ??= cell.text || undefined;
          if (link) row.links.push(link);
        }
      });
      return row;
    })
    .filter((r) => r.nickname);
}

// ── источники ────────────────────────────────────────────────────────────────

/** Строка шапки — первая, где узнали хотя бы две колонки, включая ник. */
function findHeader(grid: Grid): number {
  for (let i = 0; i < Math.min(grid.length, 20); i++) {
    const fields = (grid[i] ?? []).map((c) => fieldOf(c?.text ?? ""));
    if (fields.includes("nickname") && fields.filter(Boolean).length >= 2) return i;
  }
  return -1;
}

async function fromXlsx(src: string): Promise<Row[]> {
  const sheets = await loadWorkbook(src);
  const picked = tab ? sheets.filter((s) => s.name.toLowerCase().includes(tab.toLowerCase())) : sheets;
  if (tab && picked.length === 0) {
    throw new Error(`Вкладки «${tab}» нет. Есть: ${sheets.map((s) => s.name).join(", ")}`);
  }

  for (const s of picked) {
    const at = findHeader(s.grid);
    if (at < 0) continue;
    console.log(`вкладка «${s.name}», шапка в строке ${at + 1}`);
    const header = (s.grid[at] ?? []).map((c) => c?.text ?? "");
    const body = s.grid.slice(at + 1).map((row) => (row ?? []).map((c) => ({ text: c?.text ?? "", href: c?.href })));
    return toRows(header, body);
  }
  throw new Error(`Ни на одной вкладке не нашлась шапка с колонкой ника. Вкладки: ${sheets.map((s) => s.name).join(", ")}`);
}

/** CSV: разделитель угадываем по шапке, кавычки — по RFC (удвоенная кавычка внутри поля). */
function parseCsv(text: string): string[][] {
  const head = text.slice(0, text.indexOf("\n") + 1 || undefined);
  const delim = [";", "\t", ","].sort((a, b) => head.split(b).length - head.split(a).length)[0];

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

async function fromFile(src: string): Promise<Row[]> {
  const raw = await fs.readFile(path.resolve(src), "utf8");

  if (/\.json$/i.test(src)) {
    const data = JSON.parse(raw) as Record<string, unknown>[];
    if (!Array.isArray(data)) throw new Error("Ожидал массив объектов в JSON");
    const header = Object.keys(data[0] ?? {});
    return toRows(
      header,
      data.map((o) => header.map((k) => ({ text: String(o[k] ?? "").trim() }))),
    );
  }

  const rows = parseCsv(raw);
  const at = rows.findIndex((r) => {
    const fields = r.map(fieldOf);
    return fields.includes("nickname") && fields.filter(Boolean).length >= 2;
  });
  if (at < 0) throw new Error(`Не нашёл шапку с ником. Первая строка: ${rows[0]?.join(" | ")}`);
  return toRows(rows[at], rows.slice(at + 1).map((r) => r.map((text) => ({ text: text.trim() }))));
}

// ── разбор значений ──────────────────────────────────────────────────────────

// В CRM одна колонка «Проживает в», и пишут в неё что угодно: «Минск», «Беларусь», «Россия, Пермь».
// Разводим по нашим двум полям по списку стран — угадывать по любому слову было бы хуже, чем не угадывать.
const COUNTRIES = [
  "Беларусь", "Россия", "Украина", "Казахстан", "Польша", "Литва", "Латвия", "Эстония",
  "Армения", "Грузия", "Германия", "Молдова", "Узбекистан", "Кыргызстан", "Азербайджан",
];

function splitPlace(raw: string): { city: string | null; country: string | null } {
  const parts = raw.split(/\s*,\s*/).filter(Boolean);
  const country = parts.find((p) => COUNTRIES.some((c) => c.toLowerCase() === p.toLowerCase())) ?? null;
  const city = parts.find((p) => p !== country) ?? null;
  return { city, country };
}

/** Дата рождения, в которую можно поверить: не будущее, не позапрошлый век, игроку не меньше 10 лет. */
function plausibleBirthday(date: Date): boolean {
  const year = date.getUTCFullYear();
  return year >= 1950 && year <= new Date().getFullYear() - 10;
}

// ── свод с базой ─────────────────────────────────────────────────────────────

async function main() {
  const rows = file && !/\.xlsx$/i.test(file) ? await fromFile(file) : await fromXlsx((file ?? sheet)!);
  console.log(`из выгрузки: ${rows.length} анкет(ы)\n`);

  const players = await prisma.player.findMany();
  const byAccount = new Map(players.filter((p) => p.accountId).map((p) => [p.accountId!, p]));
  const bySlug = new Map(players.map((p) => [p.slug, p]));
  const byNick = new Map(players.map((p) => [p.nickname.toLowerCase(), p]));

  const unmatched: string[] = [];
  const problems: string[] = [];
  let touched = 0;
  let fields = 0;

  for (const row of rows) {
    const nickname = row.nickname!.trim();
    // account_id из выгрузки: колонкой или любой из ссылок на профиль (steam64 свернётся в steam32).
    // Ссылки на сайт лиги и на соцсети просто не разберутся и отсеются сами.
    const ids = new Set(
      [row.accountId ?? "", ...row.links].map(accountIdFromUrl).filter((x): x is string => Boolean(x)),
    );
    // Ссылки в анкете разъехались (в CRM встречается чужой стим, скопированный в соседнюю строку) —
    // угадывать, какая правильная, мы не вправе: не пишем ничего и зовём человека.
    if (ids.size > 1) {
      problems.push(`${nickname}: ссылки дают разные id (${[...ids].join(", ")}) — account_id не трогаю`);
    }
    const accountId = ids.size === 1 ? [...ids][0] : null;

    const player =
      (accountId ? byAccount.get(accountId) : undefined) ??
      bySlug.get(slugify(nickname)) ??
      byNick.get(nickname.toLowerCase());
    if (!player) {
      unmatched.push(nickname);
      continue;
    }

    const data: Record<string, unknown> = {};
    const put = (key: string, value: unknown, current: unknown) => {
      if (value === null || value === undefined) return;
      if (current && !force) return; // своё не затираем: в базе данные свежее, чем в CRM
      if (current === value) return;
      data[key] = value;
    };

    // Имя и фамилия в CRM разнесены по колонкам, а у нас одно поле
    const realName = [row.realName, row.lastName].map((s) => s?.trim()).filter(Boolean).join(" ");

    const place = splitPlace(row.city?.trim() ?? "");

    put("accountId", accountId, player.accountId);
    put("realName", realName || null, player.realName);
    put("city", place.city, player.city);
    put("country", row.country?.trim() || place.country, player.country);

    if (row.telegram?.trim()) {
      const handle = normalizeTelegram(row.telegram);
      if (handle) put("telegram", handle, player.telegram);
      else problems.push(`${nickname}: телеграм «${row.telegram.trim()}» не разобран`);
    }
    if (row.birthday?.trim()) {
      const date = parseBirthday(row.birthday);
      if (date && plausibleBirthday(date)) put("birthday", date, player.birthday);
      else if (date) problems.push(`${nickname}: дата ${date.toISOString().slice(0, 10)} — опечатка в CRM, не пишу`);
      else problems.push(`${nickname}: дата «${row.birthday.trim()}» не разобрана`);
    }
    // Ссылку на именной профиль (/id/<vanity>) развернуть нечем — сохраняем как есть,
    // чтобы человек мог открыть её руками и достать id.
    const vanity = row.links.find((l) => /steamcommunity\.com\/id\//i.test(l));
    if (!accountId && vanity) {
      put("steamUrl", vanity, player.steamUrl);
      problems.push(`${nickname}: именная ссылка ${vanity} — account_id из неё не достать`);
    }

    if (Object.keys(data).length === 0) continue;
    touched++;
    fields += Object.keys(data).length;
    console.log(`${player.nickname}: ${Object.entries(data).map(([k, v]) => `${k}=${v instanceof Date ? v.toISOString().slice(0, 10) : v}`).join(", ")}`);
    if (!dry) await prisma.player.update({ where: { id: player.id }, data });
  }

  console.log(`\n${dry ? "--dry: " : ""}обновлено игроков: ${touched}, полей: ${fields}`);
  if (problems.length) console.log(`\n⚠ разобрать руками (${problems.length}):\n  ${problems.join("\n  ")}`);
  if (unmatched.length) {
    console.log(`\nнет в базе (${unmatched.length}) — это игроки других дивизионов и прошлых сезонов:`);
    console.log(`  ${unmatched.join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
