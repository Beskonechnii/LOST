// Разовый бэкфилл: перенести накопленные Player.tp в реестр начислений.
//
// Запуск (из web/):  npx tsx scripts/backfill-tp-entries.ts [--tournament s2] [--dry]
//
// До появления турниров TP жили одним числом в `Player.tp`. Теперь зачёт турнирный (src/lib/tp.ts),
// и старую цифру нужно записать в реестр как начисление за тот сезон, в котором её ставили, —
// иначе новый турнир начнётся не с нуля, а с накопленного.
//
// Идемпотентно: игроков, у которых начисления в реестре уже есть, скрипт пропускает.

import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const slug = args.includes("--tournament") ? args[args.indexOf("--tournament") + 1] : "s2";

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

async function main() {
  const tournament = await prisma.tournament.findUnique({ where: { slug } });
  if (!tournament) throw new Error(`Нет турнира со слагом «${slug}»`);

  const players = await prisma.player.findMany({ where: { tp: { gt: 0 } }, select: { id: true, nickname: true, tp: true } });
  console.log(`Игроков с TP: ${players.length}; турнир: ${tournament.name}`);

  let written = 0;
  for (const p of players) {
    const already = await prisma.pointsEntry.count({
      where: { subjectType: "player", subjectId: p.id, reason: "tp" },
    });
    if (already) continue;
    console.log(`  ${p.nickname}: ${p.tp}`);
    if (!dry)
      await prisma.pointsEntry.create({
        data: {
          subjectType: "player",
          subjectId: p.id,
          reason: "tp",
          amount: p.tp,
          tournamentId: tournament.id,
          note: `перенос сезонного зачёта ${tournament.short ?? tournament.name}`,
        },
      });
    written++;
  }
  console.log(dry ? `--dry: записал бы ${written} начислений` : `Записано начислений: ${written}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
