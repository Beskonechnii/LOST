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
  if (snap.version !== 1) throw new Error(`Неизвестная версия снимка: ${snap.version}`);

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

  if (dry) {
    console.log("\n--dry: база не тронута.");
    return;
  }

  // ── производные строки: снести и создать заново ────────────────────────────
  // Порядок обратный зависимостям, иначе внешние ключи не дадут удалить.
  await prisma.render.deleteMany();
  await prisma.pointsEntry.deleteMany();
  await prisma.matchStat.deleteMany();
  await prisma.groupSeries.deleteMany();
  await prisma.groupEntry.deleteMany();
  await prisma.rosterSpot.deleteMany();
  await prisma.match.deleteMany();
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

  const matchId = new Map<string, number>();
  for (const m of snap.matches) {
    const row = await prisma.match.create({
      data: {
        openDotaMatchId: m.openDotaMatchId,
        scheduledAt: d(m.scheduledAt),
        status: m.status,
        createdAt: d(m.createdAt) ?? new Date(),
        teamAId: need(teamId, m.teamASlug, "Команда"),
        teamBId: need(teamId, m.teamBSlug, "Команда"),
        winnerTeamId: m.winnerSlug ? need(teamId, m.winnerSlug, "Команда") : null,
        radiantTeamId: m.radiantSlug ? need(teamId, m.radiantSlug, "Команда") : null,
      },
    });
    matchId.set(m.key, row.id);
  }

  for (const g of snap.groupEntries) {
    const { teamSlug, ...rest } = g;
    await prisma.groupEntry.create({ data: { ...rest, teamId: need(teamId, teamSlug, "Команда") } });
  }

  for (const s of snap.groupSeries) {
    const { homeSlug, awaySlug, ...rest } = s;
    await prisma.groupSeries.create({
      data: { ...rest, homeId: need(teamId, homeSlug, "Команда"), awayId: need(teamId, awaySlug, "Команда") },
    });
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

  console.log("\nГотово. В базе:");
  console.table({
    команды: await prisma.team.count(),
    игроки: await prisma.player.count(),
    составы: await prisma.rosterSpot.count(),
    матчи: await prisma.match.count(),
    "группы (строки)": await prisma.groupEntry.count(),
    "группы (встречи)": await prisma.groupSeries.count(),
    "стата матчей": await prisma.matchStat.count(),
    баллы: await prisma.pointsEntry.count(),
    генерации: await prisma.render.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
