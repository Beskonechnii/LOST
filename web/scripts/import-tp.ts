// Разбор TP из гугл-таблицы сезона → Player.tp. Одноразовая заливка: дальше оператор правит очки
// руками на /admin/tp. Запуск (из web/):
//   npx tsx scripts/import-tp.ts --sheet "<ссылка или id>" [--dry]
//
// Лист «Игроки»: столбец «Ник» — ник, столбец «B_TP» — очки. Игрока в базе ищем сперва по account_id
// (из ссылок Steam/Dotabuff в тех же строках — это надёжнее ника), потом по нику (точно, затем по slug).

import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { loadWorkbook, type Grid } from "./xlsx";
import { accountIdFromUrl, playerAccountId, slugify } from "../src/lib/profiles";

const args = process.argv.slice(2);
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const dry = args.includes("--dry");
const source = arg("--sheet") ?? "1hj7r-Y41qilUl3z-72e81IvJ4bgq1qqq532GEqqRmlU";

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

/** Индекс колонки по тексту заголовка (строка 0). Заголовки могут сдвинуться — не хардкодим позиции. */
const colByHeader = (grid: Grid, name: string) =>
  (grid[0] ?? []).findIndex((c) => c?.text?.trim().toLowerCase() === name.toLowerCase());

async function main() {
  const wb = await loadWorkbook(source);
  const sheet = wb.find((s) => s.name.trim().toLowerCase() === "игроки");
  if (!sheet) throw new Error(`Лист «Игроки» не найден. Есть: ${wb.map((s) => s.name).join(", ")}`);
  const grid = sheet.grid;

  const cNick = colByHeader(grid, "Ник");
  const cTp = colByHeader(grid, "B_TP");
  const cSteam = colByHeader(grid, "Steam");
  const cDb = colByHeader(grid, "Main DB");
  if (cNick < 0 || cTp < 0) throw new Error(`Нет колонок «Ник» (${cNick}) или «B_TP» (${cTp})`);

  // account_id строки — из ссылки на профиль (текст ячейки или гиперссылка). Ник вторичен: у разных
  // людей ники повторяются, а account_id уникален.
  const idFromRow = (row: Grid[number]) => {
    for (const i of [cDb, cSteam]) {
      const cell = i >= 0 ? row[i] : undefined;
      const id = accountIdFromUrl(cell?.text ?? "") ?? accountIdFromUrl(cell?.href ?? "");
      if (id) return id;
    }
    return null;
  };

  const players = await prisma.player.findMany();
  const byAccount = new Map<string, (typeof players)[number]>();
  const byNick = new Map<string, (typeof players)[number]>();
  const bySlug = new Map<string, (typeof players)[number]>();
  for (const p of players) {
    const acc = playerAccountId(p);
    if (acc && !byAccount.has(acc)) byAccount.set(acc, p);
    byNick.set(p.nickname.trim().toLowerCase(), p);
    bySlug.set(p.slug, p);
  }

  const updates: { player: (typeof players)[number]; tp: number; via: string }[] = [];
  const unmatched: { nick: string; tp: number }[] = [];

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const nick = row[cNick]?.text?.trim();
    if (!nick) continue;
    const raw = row[cTp]?.text?.trim() ?? "";
    const tp = Math.round(Number(raw));
    if (!Number.isFinite(tp) || tp <= 0) continue; // ноль/пусто/мусор пропускаем — очков нет

    const acc = idFromRow(row);
    const p =
      (acc && byAccount.get(acc)) ||
      byNick.get(nick.toLowerCase()) ||
      bySlug.get(slugify(nick)) ||
      null;

    if (!p) unmatched.push({ nick, tp });
    else updates.push({ player: p, tp, via: acc && byAccount.get(acc) === p ? "account" : "nick" });
  }

  // Один игрок мог встретиться дважды (дубль строки) — берём максимальный tp.
  const best = new Map<number, { player: (typeof players)[number]; tp: number; via: string }>();
  for (const u of updates) {
    const prev = best.get(u.player.id);
    if (!prev || u.tp > prev.tp) best.set(u.player.id, u);
  }

  console.log(`Строк с TP > 0: ${updates.length}, уникальных игроков: ${best.size}, не найдено: ${unmatched.length}`);
  for (const u of [...best.values()].sort((a, b) => b.tp - a.tp)) {
    console.log(`  ${String(u.tp).padStart(4)}  ${u.player.nickname}  (${u.via})`);
  }
  if (unmatched.length) {
    console.log("\n⚠ Не нашли в базе (ник из таблицы → tp):");
    for (const u of unmatched.sort((a, b) => b.tp - a.tp)) console.log(`  ${String(u.tp).padStart(4)}  ${u.nick}`);
  }

  if (dry) {
    console.log("\n--dry: база не тронута.");
    return;
  }

  // Зеркало столбца: сперва обнуляем всех, потом проставляем найденных — иначе снятые в таблице очки
  // остались бы в базе от прошлого прогона.
  await prisma.player.updateMany({ data: { tp: 0 } });
  for (const u of best.values()) {
    await prisma.player.update({ where: { id: u.player.id }, data: { tp: u.tp } });
  }
  console.log(`\nГотово: проставлено ${best.size} игрокам, остальным tp = 0.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
