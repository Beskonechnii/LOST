// data/snapshot.json → БД. Пара к scripts/export-db.ts: то, что забрали с git, кладём в локальную базу.
//
// Запуск (из web/):
//   npx tsx scripts/import-db.ts [--in <путь>] [--dry]
//
// Семантика — зеркало, а не слияние: после прогона база повторяет снимок один в один.
// Так и задумано: снимок в git — источник истины, иначе на двух устройствах разъедется молча.
// Что удаляется, скрипт печатает до записи; --dry показывает план, ничего не трогая.
//
// Команды и игроки обновляются upsert'ом по slug (id остаются прежними — на них завязаны ссылки в UI),
// а производные строки — составы, группы, стата, баллы — сносятся и создаются заново: у них нет
// собственного смысла помимо снимка, а так исключены дубли и осиротевшие записи.

import { readFileSync } from "node:fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";

const args = process.argv.slice(2);
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const dry = args.includes("--dry");
const input = arg("--in") ?? "data/snapshot.json";

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

const d = (v: string | Date | null | undefined) => (v ? new Date(v) : null);

async function main() {
  const snap = JSON.parse(readFileSync(input, "utf8"));
  if (snap.version !== 6) {
    throw new Error(
      `Снимок версии ${snap.version}, а нужен 6. Снимки не мигрируются: пересними базу свежим ` +
        `scripts/export-db.ts на той машине, где данные актуальны.`,
    );
  }

  console.log(`Снимок ${input}, снят ${snap.exportedAt}`);

  // ── что исчезнет ───────────────────────────────────────────────────────────
  const slugs = (rows: { slug: string }[]) => rows.map((r) => r.slug);
  const keepTeams = slugs(snap.teams);
  const keepPlayers = slugs(snap.players);
  const [goneTeams, gonePlayers] = await Promise.all([
    prisma.team.findMany({ where: { slug: { notIn: keepTeams } }, select: { slug: true, name: true } }),
    prisma.player.findMany({ where: { slug: { notIn: keepPlayers } }, select: { slug: true, nickname: true } }),
  ]);

  if (goneTeams.length || gonePlayers.length) {
    console.log("\n⚠ В снимке этого нет — будет удалено из базы:");
    for (const t of goneTeams) console.log(`  команда  ${t.name} (${t.slug})`);
    for (const p of gonePlayers) console.log(`  игрок    ${p.nickname} (${p.slug})`);
  }

  // Производные строки сносятся и создаются заново, поэтому «в снимке их меньше, чем в базе»
  // проходит молча и выглядит как обычный импорт. Молча терять руками введённую сетку встреч
  // нельзя — печатаем сверку до записи, чтобы это было видно (и остановило, если снимок не тот).
  const shrink: string[] = [];
  for (const [label, inDb, inSnap] of [
    ["встречи", await prisma.series.count(), snap.series.length],
    ["матчи", await prisma.match.count(), snap.matches.length],
    ["группы (строки)", await prisma.groupEntry.count(), snap.groupEntries.length],
    ["составы", await prisma.rosterSpot.count(), snap.rosterSpots.length],
    ["стата матчей", await prisma.matchStat.count(), snap.matchStats.length],
  ] as const) {
    if (inSnap < inDb) shrink.push(`  ${label}: в базе ${inDb} → в снимке ${inSnap} (минус ${inDb - inSnap})`);
  }
  if (shrink.length) {
    console.log("\n⚠ В снимке СТРОК МЕНЬШЕ, чем в базе — импорт их удалит:");
    for (const line of shrink) console.log(line);
    console.log("  Если снимок снят не с той машины или устарел — прервите (Ctrl+C) и переснимите.");
  }

  if (dry) {
    console.log("\n--dry: база не тронута.");
    return;
  }

  // ── производные строки: снести и создать заново ────────────────────────────
  // Порядок обратный зависимостям, иначе внешние ключи не дадут удалить.
  await prisma.render.deleteMany();
  await prisma.pointsEntry.deleteMany();
  await prisma.matchStat.deleteMany();
  await prisma.ward.deleteMany();
  // Матчи строго раньше серий: на серию ссылается карта, обратный порядок упрётся во внешний ключ.
  await prisma.match.deleteMany();
  await prisma.series.deleteMany();
  await prisma.groupEntry.deleteMany();
  await prisma.rosterSpot.deleteMany();
  await prisma.team.deleteMany({ where: { slug: { notIn: keepTeams } } });
  await prisma.player.deleteMany({ where: { slug: { notIn: keepPlayers } } });

  // ── справочники ────────────────────────────────────────────────────────────
  for (const { slug, createdAt, ...t } of snap.teams) {
    await prisma.team.upsert({
      where: { slug },
      create: { slug, ...t, createdAt: d(createdAt) ?? new Date() },
      update: t,
    });
  }
  for (const { slug, createdAt, ...p } of snap.players) {
    await prisma.player.upsert({
      where: { slug },
      create: { slug, ...p, createdAt: d(createdAt) ?? new Date() },
      update: p,
    });
  }

  const teamId = new Map((await prisma.team.findMany({ select: { id: true, slug: true } })).map((t) => [t.slug, t.id]));
  const playerId = new Map((await prisma.player.findMany({ select: { id: true, slug: true } })).map((p) => [p.slug, p.id]));
  const need = <T>(m: Map<string, T>, slug: string, what: string) => {
    const v = m.get(slug);
    if (v === undefined) throw new Error(`${what} «${slug}» есть в связях, но нет в снимке — файл битый`);
    return v;
  };

  // ── связи ──────────────────────────────────────────────────────────────────
  for (const s of snap.rosterSpots) {
    await prisma.rosterSpot.create({
      data: {
        teamId: need(teamId, s.teamSlug, "Команда"),
        playerId: need(playerId, s.playerSlug, "Игрок"),
        role: s.role,
        isCaptain: s.isCaptain,
        createdAt: d(s.createdAt) ?? new Date(),
      },
    });
  }

  // Серии — раньше матчей: карта ссылается на серию по ключу из снимка.
  const seriesId = new Map<string, number>();
  for (const s of snap.series) {
    const { homeSlug, awaySlug, playedAt, ...rest } = s;
    const row = await prisma.series.create({
      data: {
        ...rest,
        playedAt: d(playedAt),
        homeId: need(teamId, homeSlug, "Команда"),
        awayId: need(teamId, awaySlug, "Команда"),
      },
    });
    seriesId.set(row.slug, row.id);
  }

  const matchId = new Map<string, number>();
  for (const m of snap.matches) {
    const row = await prisma.match.create({
      data: {
        openDotaMatchId: m.openDotaMatchId,
        scheduledAt: d(m.scheduledAt),
        startedAt: d(m.startedAt),
        durationSec: m.durationSec ?? null,
        radiantScore: m.radiantScore ?? null,
        direScore: m.direScore ?? null,
        firstPickRadiant: m.firstPickRadiant ?? null,
        status: m.status,
        createdAt: d(m.createdAt) ?? new Date(),
        teamAId: need(teamId, m.teamASlug, "Команда"),
        teamBId: need(teamId, m.teamBSlug, "Команда"),
        winnerTeamId: m.winnerSlug ? need(teamId, m.winnerSlug, "Команда") : null,
        radiantTeamId: m.radiantSlug ? need(teamId, m.radiantSlug, "Команда") : null,
        seriesId: m.seriesSlug ? seriesId.get(m.seriesSlug) ?? null : null,
        gameNumber: m.seriesSlug ? m.gameNumber ?? null : null,
      },
    });
    matchId.set(m.key, row.id);
  }

  for (const g of snap.groupEntries) {
    const { teamSlug, ...rest } = g;
    await prisma.groupEntry.create({ data: { ...rest, teamId: need(teamId, teamSlug, "Команда") } });
  }

  for (const s of snap.matchStats) {
    const { matchKey, playerSlug, ...rest } = s;
    await prisma.matchStat.create({
      data: { ...rest, matchId: matchId.get(matchKey)!, playerId: need(playerId, playerSlug, "Игрок") },
    });
  }

  for (const p of snap.pointsEntries) {
    const { subjectSlug, subjectRawId, matchKey, createdAt, ...rest } = p;
    await prisma.pointsEntry.create({
      data: {
        ...rest,
        // caster/streamer своей таблицы пока не имеют — у них в снимке только сырой id.
        subjectId:
          rest.subjectType === "team" ? need(teamId, subjectSlug, "Команда")
          : rest.subjectType === "player" ? need(playerId, subjectSlug, "Игрок")
          : subjectRawId,
        matchId: matchKey ? matchId.get(matchKey) ?? null : null,
        createdAt: d(createdAt) ?? new Date(),
      },
    });
  }

  for (const r of snap.renders) {
    const { matchKey, createdAt, ...rest } = r;
    await prisma.render.create({
      data: { ...rest, matchId: matchKey ? matchId.get(matchKey) ?? null : null, createdAt: d(createdAt) ?? new Date() },
    });
  }

  // Варды — пачкой: строк много (тысячи), по одной было бы медленно. matchKey обязан найтись.
  if (snap.wards?.length) {
    await prisma.ward.createMany({
      data: snap.wards.map((w: { matchKey: string; teamSlug: string | null } & Record<string, unknown>) => {
        const { matchKey, teamSlug, ...rest } = w;
        return { ...rest, matchId: matchId.get(matchKey)!, teamId: teamSlug ? teamId.get(teamSlug) ?? null : null };
      }),
    });
  }

  console.log("\nГотово. В базе:");
  console.table({
    команды: await prisma.team.count(),
    игроки: await prisma.player.count(),
    составы: await prisma.rosterSpot.count(),
    матчи: await prisma.match.count(),
    "группы (строки)": await prisma.groupEntry.count(),
    встречи: await prisma.series.count(),
    "стата матчей": await prisma.matchStat.count(),
    баллы: await prisma.pointsEntry.count(),
    генерации: await prisma.render.count(),
    варды: await prisma.ward.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
