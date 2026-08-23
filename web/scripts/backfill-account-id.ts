// Проставить Player.accountId тем, у кого он выводится из ссылки на профиль.
//
// Зачем: id разбирается на лету (`playerAccountId`), поэтому матчи такого игрока и так находятся,
// но поле в БД пустое — а в него смотрят формы правки, выгрузки и импорт. Разово подтягиваем то,
// что уже известно, чтобы поле и ссылка не расходились.
//
//   npx tsx scripts/backfill-account-id.ts --dry   # показать, что изменится
//   npx tsx scripts/backfill-account-id.ts         # записать
//
// Идемпотентно: у кого поле заполнено — не трогаем; именной адрес Steam сюда не входит,
// его резолвит scripts/resolve-vanity.ts (нужен STEAM_API_KEY).

import { prisma } from "../src/lib/prisma";
import { playerAccountId } from "../src/lib/profiles";

async function main() {
  const dry = process.argv.includes("--dry");
  const players = await prisma.player.findMany({ where: { OR: [{ accountId: null }, { accountId: "" }] } });

  let written = 0;
  for (const p of players) {
    const derived = playerAccountId(p);
    if (!derived) {
      console.log(`— ${p.nickname}: взять неоткуда (нет ни id, ни разбираемой ссылки)`);
      continue;
    }
    console.log(`${dry ? "→" : "✓"} ${p.nickname}: ${derived}`);
    if (!dry) {
      await prisma.player.update({ where: { id: p.id }, data: { accountId: derived } });
      written += 1;
    }
  }

  console.log(dry ? `\nСухой прогон: заполнилось бы ${players.filter((p) => playerAccountId(p)).length}` : `\nЗаписано: ${written}`);
}

main().finally(() => prisma.$disconnect());
