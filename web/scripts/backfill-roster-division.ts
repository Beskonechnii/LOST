// Разовый бэкфилл: проставить составам дивизион турнира.
//
// Запуск (из web/):  npx tsx scripts/backfill-roster-division.ts [--dry]
//
// До появления турниров `RosterSpot` был просто «состав команды». Теперь состав принадлежит
// дивизиону турнира (сезонные составы), и существующим местам нужно проставить тот дивизион,
// в котором команда играет сейчас. Команды вне турнира остаются с NULL — это законное состояние.
//
// Идемпотентно: места с уже проставленным дивизионом не трогает.

import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";

const dry = process.argv.includes("--dry");
const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

async function main() {
  const entries = await prisma.tournamentEntry.findMany({ include: { division: { include: { tournament: true } } } });
  console.log(`Участий команд в турнирах: ${entries.length}`);

  let touched = 0;
  let skipped = 0;
  for (const e of entries) {
    const where = { teamId: e.teamId, divisionId: null };
    const count = await prisma.rosterSpot.count({ where });
    if (!count) {
      skipped++;
      continue;
    }
    console.log(`  команда #${e.teamId} → ${e.division.tournament.slug}/${e.division.slug}: мест ${count}`);
    if (!dry) await prisma.rosterSpot.updateMany({ where, data: { divisionId: e.divisionId } });
    touched += count;
  }

  const orphans = await prisma.rosterSpot.count({ where: { divisionId: null } });
  console.log(dry ? `--dry: проставил бы ${touched} мест` : `Проставлено мест: ${touched}`);
  console.log(`Команд без непроставленных мест: ${skipped}; мест вне турнира осталось: ${orphans}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
