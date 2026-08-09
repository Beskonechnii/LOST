// Проверка соответствия игроков регламенту по данным OpenDota. Ручной скрипт (как весь scripts/),
// в рантайм не тянется. Читает account_id игроков из БД, ходит в OpenDota за медалью (rank_tier)
// и числом игр, сверяет с порогами и печатает вердикт по каждому.
//
// Пороги — ДЕФОЛТНЫЕ ЗАГЛУШКИ, потому что точный регламент лиги ещё не зафиксирован. Меняются
// флагами, без правки кода:
//   --max-rank <tier>   потолок медали, tier по шкале OpenDota (70 = Divine, 55 = Legend[5]). По умолчанию 80 (Immortal, т.е. фактически без потолка).
//   --min-games <n>     минимум сыгранных игр (публичных). По умолчанию 0 (проверка выключена).
//   --player <slug>     проверить одного игрока, иначе — всех с account_id.
//   --delay <ms>        пауза между запросами (антилимит OpenDota ~60/мин). По умолчанию 1200.
//
// Пример: npx tsx scripts/check-regulation.ts --max-rank 75 --min-games 1000
//
// Важно: OpenDota больше не отдаёт точный MMR — только медаль (rank_tier). MMR-«потолок» поэтому
// выражаем медалью; ниже её грубый перевод в MMR для читаемости. Итоговое решение — за человеком.

import { prisma } from "@/lib/prisma";
import { playerAccountId } from "@/lib/profiles";

const OD = "https://api.opendota.com/api";

// Медали OpenDota: rank_tier = медаль*10 + звёзды. Грубый нижний порог MMR по медали (для читаемости).
const MEDALS: Record<number, { name: string; mmrFrom: number }> = {
  1: { name: "Herald", mmrFrom: 0 },
  2: { name: "Guardian", mmrFrom: 770 },
  3: { name: "Crusader", mmrFrom: 1540 },
  4: { name: "Archon", mmrFrom: 2310 },
  5: { name: "Legend", mmrFrom: 3080 },
  6: { name: "Ancient", mmrFrom: 3850 },
  7: { name: "Divine", mmrFrom: 4620 },
  8: { name: "Immortal", mmrFrom: 5500 },
};

function medalLabel(rankTier: number | null): string {
  if (!rankTier) return "—";
  const medal = Math.floor(rankTier / 10);
  const stars = rankTier % 10;
  const m = MEDALS[medal];
  if (!m) return String(rankTier);
  return medal === 8 ? "Immortal" : `${m.name}${stars ? " " + stars : ""}`;
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type PlayerResp = { rank_tier: number | null; profile?: { personaname?: string | null } };
type WL = { win: number; lose: number };

async function main() {
  const maxRank = Number(flag("max-rank") ?? 80);
  const minGames = Number(flag("min-games") ?? 0);
  const delay = Number(flag("delay") ?? 1200);
  const onlySlug = flag("player");

  const players = await prisma.player.findMany({
    where: onlySlug ? { slug: onlySlug } : undefined,
    select: { slug: true, nickname: true, accountId: true, dotabuffUrl: true, stratzUrl: true, steamUrl: true },
    orderBy: { nickname: "asc" },
  });

  console.log(`Регламент: медаль ≤ ${medalLabel(maxRank)} (tier ${maxRank}), игр ≥ ${minGames}. Игроков: ${players.length}.\n`);

  const problems: string[] = [];
  let checked = 0;

  for (const p of players) {
    const accountId = playerAccountId(p);
    if (!accountId) {
      problems.push(`${p.nickname}: нет account_id — опознать по OpenDota нечем`);
      continue;
    }

    const info = await getJson<PlayerResp>(`${OD}/players/${accountId}`);
    if (!info) {
      problems.push(`${p.nickname}: OpenDota не ответила (профиль приватный или сеть)`);
      await sleep(delay);
      continue;
    }
    const wl = (await getJson<WL>(`${OD}/players/${accountId}/wl?significant=0`)) ?? { win: 0, lose: 0 };
    const games = wl.win + wl.lose;
    checked++;

    const reasons: string[] = [];
    if (info.rank_tier && info.rank_tier > maxRank) reasons.push(`ранг ${medalLabel(info.rank_tier)} > потолка`);
    if (games < minGames) reasons.push(`игр ${games} < ${minGames}`);

    const verdict = reasons.length ? `❌ ${reasons.join("; ")}` : "✅ ок";
    console.log(`${p.nickname.padEnd(22)} ${medalLabel(info.rank_tier).padEnd(12)} игр ${String(games).padStart(6)}   ${verdict}`);
    if (reasons.length) problems.push(`${p.nickname}: ${reasons.join("; ")}`);

    await sleep(delay);
  }

  console.log(`\nПроверено через OpenDota: ${checked}. Замечаний: ${problems.length}.`);
  if (problems.length) {
    console.log("\nСписок замечаний:");
    for (const line of problems) console.log(`  • ${line}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
