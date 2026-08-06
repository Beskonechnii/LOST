// Разовая перечитка архива: заполнить варды у уже привязанных карт. Модель Ward появилась позже
// самих матчей, поэтому у старых карт вардов нет — гоняем syncMatch, который их теперь пишет.
//
// Запуск (из web/):
//   npx tsx scripts/backfill-wards.ts [--force] [--limit N]
//
// По умолчанию берёт только карты без вардов — можно прервать и продолжить, распарсенные не
// перечитываются заново. --force перечитывает все. Между сетевыми запросами пауза: OpenDota
// отдаёт распарсенный отчёт из кэша бесплатно, но первый разбор идёт в сеть (лимит по IP).

import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { syncMatch } from "../src/lib/match-sync";

const args = process.argv.slice(2);
const force = args.includes("--force");
const limitArg = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const matches = await prisma.match.findMany({
    where: { openDotaMatchId: { not: null } },
    select: { id: true, openDotaMatchId: true },
    orderBy: { id: "asc" },
  });

  let done = 0;
  let withWards = 0;
  let failed = 0;
  let skipped = 0;
  for (const m of matches) {
    if (done >= limitArg) break;
    if (!force && (await prisma.ward.count({ where: { matchId: m.id } })) > 0) {
      skipped++;
      continue;
    }
    try {
      await syncMatch(prisma, m.id);
      const n = await prisma.ward.count({ where: { matchId: m.id } });
      if (n > 0) withWards++;
      done++;
      console.log(`✓ #${m.openDotaMatchId} — ${n} вардов  (${done}/${matches.length})`);
    } catch (e) {
      failed++;
      console.warn(`✗ #${m.openDotaMatchId} — ${(e as Error).message}`);
    }
    await sleep(800); // щадим лимит OpenDota на промахах кэша
  }

  console.log(
    `\nГотово. Перечитано ${done}, с вардами ${withWards}, пропущено (уже есть) ${skipped}, ошибок ${failed}.`,
  );
  console.log(`Всего вардов в базе: ${await prisma.ward.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
