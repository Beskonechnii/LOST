// Импорт составов: data/roster.json → БД. Идемпотентно (upsert по slug), повторный запуск обновляет.
//
// Запуск (из web/):  npx tsx scripts/import-roster.ts
//   --file <path>   другой файл вместо data/roster.json
//   --dry           только показать, что произойдёт
//
// Картинки скрипт НЕ трогает: logo/wordmark/photo заливает scripts/import-media.ts,
// пустые поля из json их не затирают.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { slugify } from "../src/lib/profiles";

type PlayerInput = {
  slug?: string;
  nickname: string;
  realName?: string | null;
  accountId?: string | number | null;
  position?: number | null;
  isCaptain?: boolean;
  telegram?: string | null;
  steamUrl?: string | null;
  dotabuffUrl?: string | null;
  stratzUrl?: string | null;
};
type TeamInput = {
  slug?: string;
  name: string;
  tag?: string | null;
  group?: string | null;
  color?: string | null;
  players?: PlayerInput[];
};

const here = path.dirname(fileURLToPath(import.meta.url)); // web/scripts
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const fileArg = args[args.indexOf("--file") + 1];
const file = path.resolve(here, "..", args.includes("--file") && fileArg ? fileArg : "data/roster.json");

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

const stat = { teamsNew: 0, teamsUpd: 0, playersNew: 0, playersUpd: 0 };
const warnings: string[] = [];

// null и "" из json трактуем одинаково: «значение задано, но пустое» → пишем null.
// undefined = «поля нет в json» → поле не трогаем (важно для повторного импорта).
const clean = (v: string | number | null | undefined) => {
  if (v === undefined) return undefined;
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

async function importTeam(t: TeamInput) {
  const slug = t.slug?.trim() || slugify(t.name);
  if (!slug) throw new Error(`Команда «${t.name}»: не получается вывести slug — задайте его явно`);

  const data = { name: t.name.trim(), tag: clean(t.tag), group: clean(t.group), color: clean(t.color) };
  const existing = await prisma.team.findUnique({ where: { slug } });

  if (dry) {
    console.log(`  ${existing ? "обновить" : "создать "} команду ${slug} — ${data.name}`);
  } else if (existing) {
    await prisma.team.update({ where: { slug }, data });
  } else {
    await prisma.team.create({ data: { slug, ...data } });
  }
  if (existing) stat.teamsUpd++;
  else stat.teamsNew++;

  const teamId = existing?.id ?? (dry ? -1 : (await prisma.team.findUniqueOrThrow({ where: { slug } })).id);

  for (const p of t.players ?? []) await importPlayer(p, teamId, slug);
}

async function importPlayer(p: PlayerInput, teamId: number, teamSlug: string) {
  const slug = p.slug?.trim() || slugify(p.nickname);
  if (!slug) throw new Error(`Игрок «${p.nickname}» (${teamSlug}): не получается вывести slug — задайте его явно`);

  const accountId = clean(p.accountId);
  if (!accountId) warnings.push(`${teamSlug}/${slug}: нет accountId — синк статы из OpenDota для него не сработает`);

  const data = {
    nickname: p.nickname.trim(),
    realName: clean(p.realName),
    accountId,
    position: p.position ?? null,
    isCaptain: p.isCaptain ?? false,
    telegram: clean(p.telegram),
    steamUrl: clean(p.steamUrl),
    dotabuffUrl: clean(p.dotabuffUrl),
    stratzUrl: clean(p.stratzUrl),
    teamId,
  };
  const existing = await prisma.player.findUnique({ where: { slug } });

  if (dry) {
    console.log(`    ${existing ? "обновить" : "создать "} игрока  ${slug} — ${data.nickname}`);
  } else if (existing) {
    await prisma.player.update({ where: { slug }, data }); // смена команды подхватывается здесь
  } else {
    await prisma.player.create({ data: { slug, ...data } });
  }
  if (existing) stat.playersUpd++;
  else stat.playersNew++;
}

async function main() {
  const raw = await fs.readFile(file, "utf8").catch(() => {
    throw new Error(`Не найден файл составов: ${file}`);
  });
  const teams = JSON.parse(raw) as TeamInput[];
  if (!Array.isArray(teams)) throw new Error("Ожидался массив команд в корне файла");

  console.log(`Импорт составов${dry ? " (--dry, без записи)" : ""}: ${path.relative(process.cwd(), file)}`);
  for (const t of teams) await importTeam(t);

  console.log(
    `\nКоманды: +${stat.teamsNew} новых, ${stat.teamsUpd} обновлено` +
      `\nИгроки:  +${stat.playersNew} новых, ${stat.playersUpd} обновлено`,
  );
  if (warnings.length) console.log(`\n⚠ ${warnings.length}:\n  ${warnings.join("\n  ")}`);
}

main()
  .catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
