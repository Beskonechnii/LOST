// Разовая миграция данных: существующий сезон → сущности турнира.
//
// Запуск (из web/):  npx tsx scripts/seed-tournaments.ts [--name "LOST Season 2"] [--slug s2] [--dry]
//
// До появления модели `Tournament` дивизион был строкой в `Team.group` / `Series.division` /
// `GroupEntry.division` плюс хардкод-справочник в коде. Скрипт заводит турнир, дивизионы из
// встреченных строк и участие команд (`TournamentEntry`), а сериям и итогам групп проставляет
// `divisionId`. Строки при этом остаются на месте — они зеркало (src/lib/tournaments.ts).
//
// Идемпотентно: повторный запуск ничего не дублирует, только дозаполняет.

import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";

const args = process.argv.slice(2);
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const dry = args.includes("--dry");
const tName = arg("--name") ?? "LOST Season 2";
const tSlug = arg("--slug") ?? "s2";

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

/** «Division 1» → d1; всё остальное — по первым буквам слов, чтобы слаг не оказался пустым. */
function slugOf(name: string, index: number) {
  const m = name.match(/(\d+)\s*$/);
  if (m) return `d${m[1]}`;
  const letters = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return letters.slice(0, 4) || `d${index + 1}`;
}

async function main() {
  // Имена дивизионов берём из данных, а не из старого справочника: истина — то, что в базе.
  const [teams, series, entries] = await Promise.all([
    prisma.team.findMany({ orderBy: { slug: "asc" } }),
    prisma.series.findMany(),
    prisma.groupEntry.findMany(),
  ]);
  const names = [
    ...new Set(
      [...teams.map((t) => t.group), ...series.map((s) => s.division), ...entries.map((e) => e.division)]
        .map((v) => (v ?? "").trim())
        .filter(Boolean),
    ),
  ].sort();

  console.log(`Дивизионы в данных: ${names.join(", ") || "(нет)"}`);
  if (dry) {
    console.log(`--dry: завёл бы турнир «${tName}» (${tSlug}) и ${names.length} дивизион(а)`);
    console.log(`  команд: ${teams.length}, встреч: ${series.length}, строк таблицы: ${entries.length}`);
    return;
  }

  const tournament =
    (await prisma.tournament.findUnique({ where: { slug: tSlug } })) ??
    (await prisma.tournament.create({
      data: {
        slug: tSlug,
        name: tName,
        short: tSlug.toUpperCase(),
        // Сезон уже идёт — иначе публичные витрины остались бы без «текущего» турнира.
        status: "running",
        format: `${names.length} дивизион(а), групповая стадия + плей-офф`,
      },
    }));
  console.log(`Турнир: ${tournament.name} (#${tournament.id})`);

  const byName = new Map<string, number>();
  for (const [i, name] of names.entries()) {
    const slug = slugOf(name, i);
    const existing = await prisma.division.findFirst({
      where: { tournamentId: tournament.id, OR: [{ name }, { slug }] },
    });
    const division =
      existing ??
      (await prisma.division.create({
        data: {
          tournamentId: tournament.id,
          slug,
          name,
          label: `LOST ${slug.toUpperCase()}`,
          short: slug.toUpperCase(),
          orderNo: i,
        },
      }));
    byName.set(name, division.id);
    console.log(`  дивизион ${division.slug} — ${division.name} (#${division.id})`);
  }

  let spots = 0;
  for (const team of teams) {
    const divisionId = byName.get((team.group ?? "").trim());
    if (!divisionId) continue;
    await prisma.tournamentEntry.upsert({
      where: { divisionId_teamId: { divisionId, teamId: team.id } },
      create: { divisionId, teamId: team.id },
      update: {},
    });
    spots++;
  }

  let seriesFixed = 0;
  let entriesFixed = 0;
  for (const [name, divisionId] of byName) {
    seriesFixed += (
      await prisma.series.updateMany({ where: { division: name, divisionId: null }, data: { divisionId } })
    ).count;
    entriesFixed += (
      await prisma.groupEntry.updateMany({ where: { division: name, divisionId: null }, data: { divisionId } })
    ).count;
  }

  console.log(`Участие команд: ${spots}; встречам проставлен дивизион: ${seriesFixed}; строкам таблицы: ${entriesFixed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
