// Групповая стадия из таблицы сезона (вкладка «GS») → БД: GroupEntry + GroupSeries.
//
// Запуск (из web/):
//   npx tsx scripts/import-group-stage.ts --sheet <id или ссылка> [--div 1] [--dry]
//
// Формат вкладки: четыре группы стоят В ОДНОЙ строке блоками («[1 div] Группа A» и т.д.).
// У блока сверху таблица «# | Команда | И | В | П | О», ниже — кросс-таблица счетов серий (2:0, 2:1…).
//
// Главная сложность: у кросс-таблицы НЕТ подписей — в шапке логотипы, а не текст, ячейки пустые.
// Поэтому порядок команд в матрице восстанавливаем расчётом: считаем В-П-очки по каждой строке
// матрицы и сопоставляем с таблицей выше. Где подпись выходит однозначной — пишем как есть,
// где несколько команд с одинаковой строкой — помечаем guessed, чтобы поправили руками.

import { unzipSync, strFromU8 } from "fflate";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { seriesPoints } from "../src/lib/group-stage";

const args = process.argv.slice(2);
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const dry = args.includes("--dry");
const source = arg("--sheet");
const divFilter = arg("--div") ?? "1";

if (!source) {
  console.error('Укажите таблицу: --sheet "<ссылка или id>"');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

// ── чтение вкладки ───────────────────────────────────────────────────────────

const unescapeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");

function refToRc(ref: string) {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(m[2]) - 1, col: col - 1 };
}

async function readSheet(src: string, sheetName: string): Promise<string[][]> {
  const id = src.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1] ?? src;
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`);
  if (!res.ok) throw new Error(`Не скачать таблицу (${res.status}). Открыт ли доступ по ссылке?`);
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()));

  const ss = files["xl/sharedStrings.xml"];
  const shared = ss
    ? [...strFromU8(ss).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((si) =>
        [...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => unescapeXml(t[1])).join(""),
      )
    : [];

  const rels = new Map<string, string>();
  for (const r of strFromU8(files["xl/_rels/workbook.xml.rels"]).matchAll(/<Relationship([^>]*)\/>/g)) {
    const rid = r[1].match(/Id="([^"]+)"/)?.[1];
    const target = r[1].match(/Target="([^"]+)"/)?.[1];
    if (rid && target) rels.set(rid, target.replace(/^\/?xl\//, ""));
  }

  for (const s of strFromU8(files["xl/workbook.xml"]).matchAll(/<sheet\s([^>]*)\/?>/g)) {
    if (unescapeXml(s[1].match(/name="([^"]+)"/)?.[1] ?? "") !== sheetName) continue;
    const file = `xl/${rels.get(s[1].match(/r:id="([^"]+)"/)?.[1] ?? "") ?? ""}`;
    if (!files[file]) break;

    const grid: string[][] = [];
    for (const c of strFromU8(files[file]).matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = c[1].match(/r="([^"]+)"/)?.[1];
      const rc = ref ? refToRc(ref) : null;
      if (!rc) continue;
      const type = c[1].match(/t="([^"]+)"/)?.[1];
      const body = c[2] ?? "";
      const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      const inline = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => unescapeXml(t[1])).join("");
      const text = type === "s" ? (shared[Number(raw)] ?? "") : type === "inlineStr" ? inline : unescapeXml(raw);
      (grid[rc.row] ??= [])[rc.col] = text.trim();
    }
    return grid;
  }
  throw new Error(`Не нашлась вкладка «${sheetName}»`);
}

// ── разбор блока группы ──────────────────────────────────────────────────────

/** Числа в xlsx лежат как «7.0» — приводим к целому. */
const num = (s: string | undefined) => {
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
};

type SheetTeam = { name: string; place: number; played: number; wins: number; losses: number; points: number };

/**
 * Заголовки блоков: «[1 div] Группа A» → где начинается блок и что это за группа.
 * Возвращаем блоки ВСЕХ дивизионов: правая граница блока — это начало следующего,
 * и если считать её только по своему дивизиону, группа B съест колонки второго дивизиона.
 */
function findBlocks(grid: string[][]) {
  const blocks: { col: number; division: string; group: string }[] = [];
  for (const row of grid.slice(0, 5)) {
    if (!row) continue;
    row.forEach((cell, col) => {
      const m = cell?.match(/^\[(\d+)\s*div\]\s*Группа\s*(\S+)/i);
      if (m) blocks.push({ col, division: m[1], group: m[2].toUpperCase() });
    });
  }
  return blocks.sort((a, b) => a.col - b.col);
}

function parseBlock(grid: string[][], start: number, end: number) {
  // таблица: место в start, название в start+1, И/В/П/О в start+13..16
  const teams: SheetTeam[] = [];
  for (const row of grid) {
    if (!row) continue;
    const place = num(row[start]);
    const name = row[start + 1];
    const played = num(row[start + 13]);
    if (!place || !name || played === null) continue;
    teams.push({
      name,
      place,
      played,
      wins: num(row[start + 14]) ?? 0,
      losses: num(row[start + 15]) ?? 0,
      points: num(row[start + 16]) ?? 0,
    });
  }

  // кросс-таблица: ячейки вида «2:1» внутри колонок блока. Смещение у дивизионов разное,
  // поэтому строки и столбцы матрицы вычисляем по факту, а не по константам.
  const cells = new Map<string, string>();
  const rowsSet = new Set<number>();
  const colsSet = new Set<number>();
  grid.forEach((row, r) => {
    if (!row) return;
    for (let c = start; c <= end; c++) {
      if (!/^\d+:\d+$/.test(row[c] ?? "")) continue;
      cells.set(`${r}:${c}`, row[c]);
      rowsSet.add(r);
      colsSet.add(c);
    }
  });

  const mRows = [...rowsSet].sort((a, b) => a - b);
  const mCols = [...colsSet].sort((a, b) => a - b);
  const matrix = mRows.map((r) => mCols.map((c) => cells.get(`${r}:${c}`) ?? null));
  return { teams: teams.sort((a, b) => a.place - b.place), matrix };
}

/** Строка матрицы → её В/П/очки, чтобы узнать команду по «отпечатку». */
function rowRecord(row: (string | null)[]) {
  let wins = 0;
  let losses = 0;
  let points = 0;
  for (const cell of row) {
    if (!cell) continue;
    const [own, opp] = cell.split(":").map(Number);
    if (own > opp) wins++;
    else losses++;
    points += seriesPoints(own, opp);
  }
  return { wins, losses, points };
}

// ── импорт ───────────────────────────────────────────────────────────────────

async function main() {
  const division = `Division ${divFilter}`;
  const grid = await readSheet(source!, "GS");
  const allBlocks = findBlocks(grid);
  const blocks = allBlocks.filter((b) => b.division === divFilter);
  if (blocks.length === 0) throw new Error(`Не нашлось групп дивизиона ${divFilter} на вкладке «GS»`);

  const width = grid.reduce((w, r) => Math.max(w, r?.length ?? 0), 0);

  for (const block of blocks) {
    const end = (allBlocks.find((b) => b.col > block.col)?.col ?? width) - 1;
    const { teams, matrix } = parseBlock(grid, block.col, end);
    console.log(`\n[${division}] Группа ${block.group}: ${teams.length} команд, матрица ${matrix.length}×${matrix[0]?.length ?? 0}`);

    const dbTeams = new Map<string, number>();
    for (const t of teams) {
      const team = await prisma.team.findFirst({ where: { name: t.name } });
      if (!team) {
        console.log(`  ⚠ нет в базе: «${t.name}» — строка пропущена`);
        continue;
      }
      dbTeams.set(t.name, team.id);
      if (dry) continue;
      await prisma.groupEntry.upsert({
        where: { division_group_teamId: { division, group: block.group, teamId: team.id } },
        create: { division, group: block.group, teamId: team.id, place: t.place, played: t.played, wins: t.wins, losses: t.losses, points: t.points },
        update: { place: t.place, played: t.played, wins: t.wins, losses: t.losses, points: t.points },
      });
    }

    if (matrix.length !== teams.length) {
      console.log(`  ⚠ матрица не совпала с числом команд — встречи пропущены`);
      continue;
    }

    // «отпечаток» В-П-очки → команды с такой строкой. Одна — подпись точная, несколько — догадка.
    const byFingerprint = new Map<string, SheetTeam[]>();
    for (const t of teams) {
      const key = `${t.wins}-${t.losses}-${t.points}`;
      if (!byFingerprint.has(key)) byFingerprint.set(key, []);
      byFingerprint.get(key)!.push(t);
    }

    const used = new Set<string>();
    const order: (SheetTeam | null)[] = matrix.map((row) => {
      const rec = rowRecord(row);
      const cands = (byFingerprint.get(`${rec.wins}-${rec.losses}-${rec.points}`) ?? []).filter((t) => !used.has(t.name));
      const pick = cands[0] ?? null;
      if (pick) used.add(pick.name);
      return pick;
    });

    const ambiguous = new Set(
      [...byFingerprint.values()].filter((list) => list.length > 1).flatMap((list) => list.map((t) => t.name)),
    );

    let written = 0;
    let guessedCount = 0;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = r + 1; c < matrix.length; c++) {
        const cell = matrix[r][c];
        const home = order[r];
        const away = order[c];
        if (!cell || !home || !away) continue;
        const homeId = dbTeams.get(home.name);
        const awayId = dbTeams.get(away.name);
        if (!homeId || !awayId) continue;

        const [homeScore, awayScore] = cell.split(":").map(Number);
        const guessed = ambiguous.has(home.name) || ambiguous.has(away.name);
        if (guessed) guessedCount++;
        written++;
        if (dry) continue;
        await prisma.groupSeries.upsert({
          where: { division_group_homeId_awayId: { division, group: block.group, homeId, awayId } },
          create: { division, group: block.group, homeId, awayId, homeScore, awayScore, guessed },
          update: { homeScore, awayScore, guessed },
        });
      }
    }

    const unresolved = order.filter((t) => !t).length;
    console.log(`  встреч: ${written}${guessedCount ? `, из них под вопросом: ${guessedCount}` : ""}`);
    if (unresolved) console.log(`  ⚠ строк матрицы без команды: ${unresolved}`);
    if (ambiguous.size) console.log(`  ⚠ одинаковая строка В-П-очки: ${[...ambiguous].join(", ")} — проверить руками`);
  }

  if (dry) console.log("\n--dry: в базу не писали");
}

main()
  .catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
