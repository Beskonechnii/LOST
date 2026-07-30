// Именные ссылки Steam → account_id игрока.
//
// Запуск (из web/):
//   npx tsx scripts/resolve-vanity.ts [--dry]
//
// Зачем. В архив матча игрок попадает по `account_id`; если его нет, человек в статистике
// не появится вообще. Ссылки на Dotabuff/Stratz/OpenDota и steamcommunity.com/profiles/<steam64>
// разбираются на месте (`accountIdFromUrl` в src/lib/profiles.ts) — а вот именной адрес
// steamcommunity.com/id/<vanity> в число не превращается ничем, кроме Steam Web API.
//
// Поэтому это скрипт, а не рантайм: один поход в Steam на игрока, результат пишем в БД навсегда.
// Нужен STEAM_API_KEY в web/.env (тот же, что у запасного источника матча).

import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { playerAccountId } from "../src/lib/profiles";

const dry = process.argv.includes("--dry");

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

const STEAM64_BASE = BigInt("76561197960265728");

/** steamcommunity.com/id/<vanity> → vanity. Всё остальное нас здесь не касается. */
const vanityOf = (url: string | null) =>
  url?.replace(/^https?:\/\//i, "").match(/^(?:www\.)?steamcommunity\.com\/id\/([^/?#]+)/i)?.[1] ?? null;

async function resolve(vanity: string, key: string): Promise<string | null> {
  const url = new URL("https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/");
  url.searchParams.set("key", key);
  url.searchParams.set("vanityurl", vanity);
  const res = await fetch(url);
  if (res.status === 403) throw new Error("Steam отклонил ключ (403). Проверь STEAM_API_KEY.");
  if (!res.ok) throw new Error(`Steam ответил ${res.status}`);
  const json = (await res.json()) as { response?: { success?: number; steamid?: string } };
  // success=1 — нашли, 42 — такого имени нет. Иных вариантов Valve не документирует.
  if (json.response?.success !== 1 || !json.response.steamid) return null;
  return String(BigInt(json.response.steamid) - STEAM64_BASE);
}

async function main() {
  const key = process.env.STEAM_API_KEY;
  if (!key) throw new Error("Нет STEAM_API_KEY в web/.env — ключ берётся на steamcommunity.com/dev/apikey.");

  const players = await prisma.player.findMany({
    select: { id: true, nickname: true, accountId: true, dotabuffUrl: true, stratzUrl: true, steamUrl: true },
  });

  // Берём только тех, у кого id не выводится вообще ниоткуда: если ссылка на Dotabuff есть,
  // `playerAccountId` уже справится и ходить в Steam незачем.
  const targets = players
    .map((p) => ({ ...p, vanity: playerAccountId(p) ? null : vanityOf(p.steamUrl) }))
    .filter((p): p is typeof p & { vanity: string } => !!p.vanity);

  console.log(`Именных ссылок к разбору: ${targets.length}`);

  let ok = 0;
  for (const p of targets) {
    const accountId = await resolve(p.vanity, key);
    if (!accountId) {
      console.log(`  ✗ ${p.nickname} — Steam не знает имени «${p.vanity}»`);
      continue;
    }
    console.log(`  ✓ ${p.nickname} → ${accountId}`);
    ok++;
    if (!dry) await prisma.player.update({ where: { id: p.id }, data: { accountId } });
  }

  const left = (
    await prisma.player.findMany({ select: { nickname: true, accountId: true, dotabuffUrl: true, stratzUrl: true, steamUrl: true } })
  ).filter((p) => !playerAccountId(p));

  console.log(`\nПроставлено: ${ok}${dry ? " (--dry: в базу не писали)" : ""}`);
  if (left.length) {
    console.log(`Всё ещё без account_id (${left.length}) — им нужна ссылка на профиль в анкете:`);
    console.log(`  ${left.map((p) => p.nickname).join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
