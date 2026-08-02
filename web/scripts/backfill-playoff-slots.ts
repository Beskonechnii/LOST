// Разовый бэкфилл: проставить `slot` серий плей-офф, заведённых прежней формой (по свободному
// раунду, без позиции в сетке). Сопоставляем пары команд слотам шаблона жадно, сверху вниз:
// разобрав слот, знаем его победителя/проигравшего и потому — участников следующих слотов.
//
//   npx tsx scripts/backfill-playoff-slots.ts --dry   # показать сопоставление, не трогая базу
//   npx tsx scripts/backfill-playoff-slots.ts         # записать slot/bracket/round
//
// Идемпотентно: серии с уже проставленным slot не трогает; повторный запуск ничего не меняет.

import { prisma } from "@/lib/prisma";
import { getQualified } from "@/lib/group-stage";
import { PLAYOFF_SLOTS, slotByKey, type SlotSource } from "@/lib/playoff-bracket";
import { DIVISIONS } from "@/lib/divisions";

const dry = process.argv.includes("--dry");
const need = (bestOf: 3 | 5) => (bestOf === 5 ? 3 : 2);

async function backfillDivision(division: string) {
  const { upper, lower } = await getQualified(division);
  const seeds = new Map<string, number>(); // «A1» → teamId
  for (const r of [...upper, ...lower]) seeds.set(`${r.group}${r.place}`, r.teamId);

  const series = await prisma.series.findMany({
    where: { division, stage: "playoff" },
    select: { id: true, slot: true, homeId: true, awayId: true, homeScore: true, awayScore: true },
  });
  const free = series.filter((s) => !s.slot); // уже размеченные не трогаем
  if (free.length === 0) return { assigned: 0, total: series.length };

  const winnerOf = new Map<string, number>();
  const loserOf = new Map<string, number>();
  const used = new Set<number>();

  const teamOfSource = (src: SlotSource): number | null => {
    if (src.kind === "seed") return seeds.get(`${src.group}${src.place}`) ?? null;
    return (src.kind === "winner" ? winnerOf : loserOf).get(src.slot) ?? null;
  };

  let assigned = 0;
  for (const def of PLAYOFF_SLOTS) {
    const a = teamOfSource(def.a);
    const b = teamOfSource(def.b);

    // Уже размеченная серия этого слота (из прошлого запуска) — учитываем её исход и идём дальше.
    const already = series.find((s) => s.slot === def.key);
    const decided = (s: { homeScore: number; awayScore: number }) =>
      s.homeScore !== s.awayScore && (s.homeScore === need(def.bestOf) || s.awayScore === need(def.bestOf));
    const record = (s: { homeId: number; awayId: number; homeScore: number; awayScore: number }) => {
      if (!decided(s)) return;
      const homeWon = s.homeScore > s.awayScore;
      winnerOf.set(def.key, homeWon ? s.homeId : s.awayId);
      loserOf.set(def.key, homeWon ? s.awayId : s.homeId);
    };
    if (already) {
      record(already);
      continue;
    }
    if (a == null || b == null) continue; // участники слота ещё неизвестны — пропускаем

    const match = free.find(
      (s) => !used.has(s.id) && ((s.homeId === a && s.awayId === b) || (s.homeId === b && s.awayId === a)),
    );
    if (!match) continue;

    used.add(match.id);
    assigned++;
    const slot = slotByKey(def.key)!;
    console.log(`  ${def.key.padEnd(8)} ← серия ${match.id} (${match.homeScore}:${match.awayScore})`);
    if (!dry) {
      await prisma.series.update({
        where: { id: match.id },
        data: { slot: def.key, bracket: slot.bracket, round: slot.round },
      });
    }
    record(match);
  }

  const orphans = free.filter((s) => !used.has(s.id));
  if (orphans.length) console.log(`  ⚠ не легли в сетку: ${orphans.map((s) => s.id).join(", ")}`);
  return { assigned, total: series.length };
}

async function main() {
  console.log(dry ? "— dry-run: база не тронута —\n" : "— запись —\n");
  for (const d of DIVISIONS) {
    console.log(`${d.label} (${d.name}):`);
    const { assigned, total } = await backfillDivision(d.name);
    console.log(`  итого: размечено ${assigned} из ${total} плей-офф серий\n`);
  }
  await prisma.$disconnect();
}

main();
