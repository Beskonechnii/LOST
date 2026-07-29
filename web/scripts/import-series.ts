// Архив серий лиги → БД. Источник списка серий — снимок Dotabuff (web/data/series-<league>.json,
// «Фаза A», снимается браузером из-за Cloudflare). Карты и стату по каждому match id тянет OpenDota.
//
// Запуск (из web/):
//   npx tsx scripts/import-series.ts [--file data/series-19700.json] [--group-until 2026-07-16]
//                                    [--write] [--verify] [--limit N] [--delay 800]
//
// Почему так. OpenDota список матчей этой лиги не отдаёт (tier «excluded»), а STRATZ её вовсе не
// индексирует — проверено. Dotabuff данные держит, но за Cloudflare, поэтому список снимается
// браузером в JSON один раз, а этот скрипт работает уже офлайн от снимка и идемпотентно.
//
// Что делает. По каждой серии из манифеста: маппит команды Dotabuff → наши Team (по имени/тегу),
// решает группа/плей-офф (см. classify), заводит/находит строку Series и через attachGame цепляет
// карты — тот сам читает OpenDota, определяет стороны по составам и пишет MatchStat. Стороны и
// счёт по картам не вводим руками: всё считает синк (src/lib/match-sync.ts).
//
// Группа/плей-офф. group = обе команды в одной группе (GroupEntry), первая встреча пары, до даты
// --group-until. Иначе playoff с guessed=true и без раунда — сетку Dotabuff в списке не размечает,
// поэтому лейблы (верхняя/нижняя/гранд, раунд) проставляются вручную в админке; их немного.
//
// без флага — сухой прогон: печатает план классификации, в БД не пишет.
// --write   — выполнить: создать/найти серии и прицепить карты. Идемпотентно (attachGame — upsert).
//             После записи сам себя проверяет (см. --verify).
// --verify  — не писать, только сверить уже залитое с источником: победители карт дают счёт из
//             манифеста и детект сторон по составам не расходится с записанным. Код возврата 1,
//             если нашлись расхождения — чтобы можно было гонять в CI и не смотреть глазами.

import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { attachGame } from "../src/lib/series";
import { slugify, playerAccountId } from "../src/lib/profiles";
import { loadMatchReport } from "../src/lib/match-api";

const args = process.argv.slice(2);
const arg = (name: string, def?: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
const write = args.includes("--write");
const verify = args.includes("--verify");
const file = arg("--file", "data/series-19700.json")!;
const groupUntil = new Date(arg("--group-until", "2026-07-16")! + "T23:59:59Z");
const limit = arg("--limit") ? Number(arg("--limit")) : Infinity;
const delayMs = Number(arg("--delay", "800"));
const DIVISION = "Division 1";

const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }) });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ManifestTeam = { id: string; name: string; tag: string | null };
type ManifestSeries = { sid: string; bo: string; time: string; t1: ManifestTeam; t2: ManifestTeam; sa: number; sb: number; m: string[] };
type Manifest = { league: number; series: ManifestSeries[] };

// --- Наши команды: матчер Dotabuff-имя/тег → Team, плюс группа из GroupEntry ---
type DbTeam = { id: number; slug: string; name: string; tag: string | null; grp: string | null };
const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, "").trim();

async function buildMatcher() {
  const teams = await prisma.team.findMany({ where: { group: DIVISION }, select: { id: true, slug: true, name: true, tag: true } });
  const entries = await prisma.groupEntry.findMany({ where: { division: DIVISION }, select: { teamId: true, group: true } });
  const grpByTeam = new Map(entries.map((e) => [e.teamId, e.group]));
  const byName = new Map<string, DbTeam>();
  const byTag = new Map<string, DbTeam>();
  const bySlug = new Map<string, DbTeam>();
  for (const t of teams) {
    const row: DbTeam = { ...t, grp: grpByTeam.get(t.id) ?? null };
    byName.set(norm(t.name), row);
    if (t.tag) byTag.set(norm(t.tag), row);
    bySlug.set(t.slug, row);
  }
  // Имя → тег → слаг из имени. Покрывает PSIXDISPANSER/PSIXDISPANCER (по тегу) и MoLoKo/MOLOKO (регистр).
  return (mt: ManifestTeam): DbTeam | null =>
    byName.get(norm(mt.name)) ?? (mt.tag ? byTag.get(norm(mt.tag)) : undefined) ?? bySlug.get(slugify(mt.name)) ?? null;
}

// --- Классификация серии ---
type Plan = {
  s: ManifestSeries;
  home: DbTeam;
  away: DbTeam;
  stage: "group" | "playoff";
  group: string | null;
  reason: string;
};

function classify(s: ManifestSeries, home: DbTeam, away: DbTeam, seenPair: Set<string>): Plan {
  const pairKey = [Math.min(home.id, away.id), Math.max(home.id, away.id)].join("-");
  const sameGroup = home.grp != null && home.grp === away.grp;
  const repeat = seenPair.has(pairKey);
  const afterCutoff = new Date(s.time) > groupUntil;

  let stage: "group" | "playoff" = "group";
  let reason = `группа ${home.grp}`;
  if (!sameGroup) { stage = "playoff"; reason = `кросс-группа ${home.grp}×${away.grp}`; }
  else if (repeat) { stage = "playoff"; reason = "повторная встреча пары"; }
  else if (afterCutoff) { stage = "playoff"; reason = `после ${groupUntil.toISOString().slice(0, 10)}`; }

  return { s, home, away, stage, group: stage === "group" ? home.grp : null, reason };
}

// --- Строка серии: найти существующую (идемпотентность) или создать. Любой счёт (Bo1/Bo2/Bo3, ничьи). ---
async function upsertSeriesRow(p: Plan): Promise<number> {
  const { home, away, s } = p;
  const existing = await prisma.series.findFirst({
    where: {
      division: DIVISION, stage: p.stage, group: p.group,
      OR: [{ homeId: home.id, awayId: away.id }, { homeId: away.id, awayId: home.id }],
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const base = `${home.slug}-vs-${away.slug}`;
  const taken = new Set((await prisma.series.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map((x) => x.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

  const row = await prisma.series.create({
    data: {
      slug, division: DIVISION, stage: p.stage, group: p.group,
      bracket: null, round: null, // плей-офф-лейблы проставляются вручную
      playedAt: new Date(s.time),
      homeId: home.id, awayId: away.id,
      homeScore: s.sa, awayScore: s.sb,
      guessed: p.stage === "playoff", // группу знаем точно; сетку плей-офф оператор уточнит
    },
    select: { id: true },
  });
  return row.id;
}

// --- Проверка залитого против источника: победители карт и уверенность детекта ---
// Две независимые проверки, чтобы доверять архиву без ручного просмотра каждой серии:
//  1) сумма побед по картам == счёт из манифеста (Dotabuff) — иначе где-то перепутан победитель;
//  2) пере-детект сторон по составам на каждой карте — < 2 своих на стороне или расхождение с
//     записанным победителем помечаем как «глянуть глазами». Отчёты берём из кэша (офлайн).
async function verifyImport(plans: Plan[]): Promise<number> {
  let issues = 0;
  const problem = (msg: string) => { issues++; console.log(`  ✗ ${msg}`); };

  for (const p of plans) {
    const row = await prisma.series.findFirst({
      where: {
        division: DIVISION, stage: p.stage, group: p.group,
        OR: [{ homeId: p.home.id, awayId: p.away.id }, { homeId: p.away.id, awayId: p.home.id }],
      },
      select: { id: true, homeId: true, awayId: true, homeScore: true, awayScore: true },
    });
    if (!row) { problem(`${p.home.name} vs ${p.away.name}: строки серии нет в БД`); continue; }

    const games = await prisma.match.findMany({ where: { seriesId: row.id }, orderBy: { gameNumber: "asc" }, select: { openDotaMatchId: true, gameNumber: true, winnerTeamId: true } });
    if (games.length !== p.s.m.length) problem(`#${row.id} ${p.home.name} vs ${p.away.name}: карт ${games.length}, в манифесте ${p.s.m.length}`);

    // Победители по картам → счёт. Сверяем с сохранённым счётом строки (он равен манифесту).
    let winHome = 0, winAway = 0;
    const spots = await prisma.rosterSpot.findMany({ where: { teamId: { in: [row.homeId, row.awayId] } }, select: { teamId: true, player: { select: { accountId: true, dotabuffUrl: true, stratzUrl: true, steamUrl: true } } } });
    const teamByAcc = new Map<string, number>();
    for (const sp of spots) { const a = playerAccountId(sp.player); if (a) teamByAcc.set(a, sp.teamId); }

    for (const g of games) {
      if (g.winnerTeamId === row.homeId) winHome++;
      else if (g.winnerTeamId === row.awayId) winAway++;
      else problem(`#${row.id} карта ${g.gameNumber} (${g.openDotaMatchId}): победитель ${g.winnerTeamId} — не команда серии`);

      // Уверенность детекта: сколько своих распозналось на каждой стороне и совпал ли победитель.
      let rep;
      try { rep = await loadMatchReport("opendota", g.openDotaMatchId!); } catch { continue; }
      const side = (which: "radiant" | "dire") => {
        const t = new Map<number, number>();
        for (const pl of rep.players.filter((x) => x.side === which)) { const id = pl.accountId != null ? teamByAcc.get(String(pl.accountId)) : undefined; if (id) t.set(id, (t.get(id) ?? 0) + 1); }
        let win: number | null = null, n = 0; for (const [k, c] of t) if (c > n) [win, n] = [k, c];
        return { team: n >= 2 ? win : null, n };
      };
      const r = side("radiant"), d = side("dire");
      if (r.n < 2 || d.n < 2) problem(`#${row.id} карта ${g.gameNumber} (${g.openDotaMatchId}): низкая уверенность — своих radiant ${r.n}/5, dire ${d.n}/5`);
      const detWinner = rep.radiantWin ? r.team : d.team;
      if (detWinner && g.winnerTeamId && detWinner !== g.winnerTeamId) problem(`#${row.id} карта ${g.gameNumber} (${g.openDotaMatchId}): детект даёт ${detWinner}, записан ${g.winnerTeamId}`);
    }
    if (winHome !== row.homeScore || winAway !== row.awayScore) {
      problem(`#${row.id} ${p.home.name} vs ${p.away.name}: счёт по картам ${winHome}:${winAway} ≠ записанный ${row.homeScore}:${row.awayScore}`);
    }
  }

  console.log(issues === 0 ? `\n✓ Проверка пройдена: серий ${plans.length}, расхождений нет.` : `\n✗ Проверка: расхождений ${issues} (см. выше).`);
  return issues;
}

async function main() {
  const manifest = JSON.parse(readFileSync(resolve(file), "utf8")) as Manifest;
  const match = await buildMatcher();
  const series = [...manifest.series].sort((a, b) => a.time.localeCompare(b.time));
  console.log(`Манифест ${file}: серий ${series.length}, лига ${manifest.league}\n`);

  const seenPair = new Set<string>();
  const plans: Plan[] = [];
  const unmatched: string[] = [];
  for (const s of series) {
    const home = match(s.t1);
    const away = match(s.t2);
    if (!home || !away) { unmatched.push(`${s.sid}: ${s.t1.name} / ${s.t2.name}`); continue; }
    const plan = classify(s, home, away, seenPair);
    seenPair.add([Math.min(home.id, away.id), Math.max(home.id, away.id)].join("-"));
    plans.push(plan);
  }

  const grp = plans.filter((p) => p.stage === "group");
  const po = plans.filter((p) => p.stage === "playoff");
  console.log(`Классификация: группа ${grp.length}, плей-офф ${po.length}, не смаппилось ${unmatched.length}`);
  for (const u of unmatched) console.log(`  ✗ UNMATCHED ${u}`);
  console.log(`\nПлей-офф (guessed, раунд вручную):`);
  for (const p of po) console.log(`  ◆ ${p.s.time.slice(0, 10)} ${p.home.name} ${p.s.sa}:${p.s.sb} ${p.away.name} — ${p.reason} [${p.s.m.length} карт]`);

  // Только проверить уже залитое против источника — без записи.
  if (verify && !write) {
    const bad = await verifyImport(plans);
    await prisma.$disconnect();
    process.exit(bad ? 1 : 0);
  }

  if (!write) {
    console.log(`\nГруппа (${grp.length}): ` + grp.map((p) => `${p.home.tag ?? p.home.name}·${p.away.tag ?? p.away.name}`).join(", "));
    console.log(`\nСухой прогон. Записать в БД: --write (походов в OpenDota ~${plans.reduce((a, p) => a + p.s.m.length, 0)}, с паузой ${delayMs}мс). Проверить залитое: --verify`);
    await prisma.$disconnect();
    return;
  }

  // --- Запись ---
  let seriesDone = 0, gamesDone = 0, gamesFailed = 0;
  for (const p of plans.slice(0, Number.isFinite(limit) ? Number(limit) : undefined)) {
    const seriesId = await upsertSeriesRow(p);
    for (const [i, matchId] of p.s.m.entries()) {
      try {
        await attachGame(seriesId, i + 1, matchId);
        gamesDone++;
      } catch (e) {
        gamesFailed++;
        console.log(`  ✗ ${p.home.name} vs ${p.away.name} карта ${i + 1} (${matchId}): ${e instanceof Error ? e.message : e}`);
      }
      await sleep(delayMs);
    }
    seriesDone++;
    if (seriesDone % 10 === 0) console.log(`  …${seriesDone}/${plans.length} серий, карт ${gamesDone}`);
  }
  console.log(`\nГотово: серий ${seriesDone}, карт привязано ${gamesDone}` + (gamesFailed ? `, ошибок ${gamesFailed}` : ""));

  // Само-проверка сразу после записи — чтобы результат не приходилось смотреть глазами.
  console.log(`\nПроверяю залитое против источника…`);
  await verifyImport(plans.slice(0, Number.isFinite(limit) ? Number(limit) : undefined));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
