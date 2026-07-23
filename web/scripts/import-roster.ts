// Импорт составов: data/roster.json → БД. Идемпотентно (upsert по slug), повторный запуск обновляет.
//
// Запуск (из web/):  npx tsx scripts/import-roster.ts
//   --file <path>   другой файл вместо data/roster.json
//   --dry           только показать, что произойдёт
//
// Картинки скрипт НЕ трогает: logo/wordmark/photo заливает scripts/import-media.ts,
// пустые поля из json их не затирают.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { slugify } from "../src/lib/profiles";
import { isRole } from "../src/lib/roles";
import { isCoreRole } from "../src/lib/roster-spots";

type PlayerInput = {
  slug?: string;
  nickname: string;
  realName?: string | null;
  accountId?: string | number | null;
  mmr?: number | string | null;
  role?: string | null; // carry | mid | offlane | soft-support | hard-support | coach | standin
  isCaptain?: boolean;
  telegram?: string | null;
  steamUrl?: string | null;
  dotabuffUrl?: string | null;
  stratzUrl?: string | null;
};
type TeamInput = {
  slug?: string;
  name: string;
  tag?: string | null;
  group?: string | null;
  color?: string | null;
  players?: PlayerInput[];
};

const here = path.dirname(fileURLToPath(import.meta.url)); // web/scripts
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const fileArg = args[args.indexOf("--file") + 1];
const file = path.resolve(here, "..", args.includes("--file") && fileArg ? fileArg : "data/roster.json");

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

const stat = { teamsNew: 0, teamsUpd: 0, playersNew: 0, playersUpd: 0, spotsGone: 0 };
const warnings: string[] = [];
/** «teamId:playerId» мест, которые есть в файле — всё остальное в этих командах вычищаем после импорта. */
const seenSpots = new Set<string>();

// null и "" из json трактуем одинаково: «значение задано, но пустое» → пишем null.
// undefined = «поля нет в json» → поле не трогаем (важно для повторного импорта).
const clean = (v: string | number | null | undefined) => {
  if (v === undefined) return undefined;
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

async function importTeam(t: TeamInput) {
  const slug = t.slug?.trim() || slugify(t.name);
  if (!slug) throw new Error(`Команда «${t.name}»: не получается вывести slug — задайте его явно`);

  const data = { name: t.name.trim(), tag: clean(t.tag), group: clean(t.group), color: clean(t.color) };
  const existing = await prisma.team.findUnique({ where: { slug } });

  if (dry) {
    console.log(`  ${existing ? "обновить" : "создать "} команду ${slug} — ${data.name}`);
  } else if (existing) {
    await prisma.team.update({ where: { slug }, data });
  } else {
    await prisma.team.create({ data: { slug, ...data } });
  }
  if (existing) stat.teamsUpd++;
  else stat.teamsNew++;

  const teamId = existing?.id ?? (dry ? -1 : (await prisma.team.findUniqueOrThrow({ where: { slug } })).id);

  for (const p of t.players ?? []) await importPlayer(p, teamId, slug);
}

async function importPlayer(p: PlayerInput, teamId: number, teamSlug: string) {
  const slug = p.slug?.trim() || slugify(p.nickname);
  if (!slug) throw new Error(`Игрок «${p.nickname}» (${teamSlug}): не получается вывести slug — задайте его явно`);

  const accountId = clean(p.accountId);
  if (!accountId) warnings.push(`${teamSlug}/${slug}: нет accountId — синк статы из OpenDota для него не сработает`);
  if (p.role && !isRole(p.role)) warnings.push(`${teamSlug}/${slug}: неизвестная роль «${p.role}» — записал пустой`);

  // Карточка игрока — про человека; роль и капитанство лежат на месте в составе (RosterSpot).
  const data = {
    nickname: p.nickname.trim(),
    realName: clean(p.realName),
    accountId,
    mmr: mmrOf(p.mmr),
    telegram: clean(p.telegram),
    steamUrl: clean(p.steamUrl),
    dotabuffUrl: clean(p.dotabuffUrl),
    stratzUrl: clean(p.stratzUrl),
  };
  const role = isRole(p.role) ? p.role : null;
  const existing = await prisma.player.findUnique({ where: { slug } });

  if (dry) {
    console.log(`    ${existing ? "обновить" : "создать "} игрока  ${slug} — ${data.nickname} (${role ?? "без роли"})`);
    if (existing) stat.playersUpd++;
    else stat.playersNew++;
    return;
  }

  const player = existing
    ? await prisma.player.update({ where: { slug }, data })
    : await prisma.player.create({ data: { slug, ...data } });
  if (existing) stat.playersUpd++;
  else stat.playersNew++;

  await prisma.rosterSpot.upsert({
    where: { teamId_playerId: { teamId, playerId: player.id } },
    create: { teamId, playerId: player.id, role, isCaptain: p.isCaptain ?? false },
    update: { role, isCaptain: p.isCaptain ?? false },
  });
  seenSpots.add(`${teamId}:${player.id}`);
}

/** MMR в таблице живёт как «7314.0» — приводим к целому; мусор и нули считаем «не указан». */
const mmrOf = (v: number | string | null | undefined) => {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

const slugOf = (t: TeamInput) => t.slug?.trim() || slugify(t.name);

/**
 * Дубль команды — всегда ошибка данных, и молча импортировать его нельзя: в БД остаются две карточки
 * одной команды, а игроки уезжают в ту, что залилась последней. Поэтому проверяем ДО записи и падаем.
 * Ловим три случая: один слаг дважды в файле, одна команда под разными слагами (в файле и в БД),
 * и один игрок действующим сразу в двух командах.
 */
async function assertNoDuplicates(teams: TeamInput[]) {
  const errors: string[] = [];

  const bySlug = new Map<string, TeamInput>();
  const byName = new Map<string, string>(); // «имя @ дивизион» → слаг
  for (const t of teams) {
    const slug = slugOf(t);
    if (bySlug.has(slug)) errors.push(`слаг «${slug}» встречается в файле дважды`);
    bySlug.set(slug, t);

    const key = `${t.name.trim().toLowerCase()} @ ${clean(t.group) ?? "—"}`;
    const twin = byName.get(key);
    if (twin && twin !== slug) {
      errors.push(`«${t.name}» в файле дважды — под слагами «${twin}» и «${slug}»; оставьте один`);
    }
    byName.set(key, slug);
  }

  // та же команда, уже лежащая в БД под другим слагом (например, от прошлого прогона с --alias)
  for (const [slug, t] of bySlug) {
    const twins = await prisma.team.findMany({ where: { name: t.name.trim() } });
    for (const tw of twins) {
      if (tw.slug === slug || (tw.group ?? null) !== (clean(t.group) ?? null)) continue;
      errors.push(
        `«${t.name}» уже есть в БД под слагом «${tw.slug}», а импортируется как «${slug}» — будет дубль. ` +
          `Удалите лишнюю команду или задайте slug явно`,
      );
    }
  }

  // Стоять в нескольких составах можно, действующим (поз. 1–5) — только в одном:
  // в матче человек сыграет за одну команду, иначе стата и составы разъедутся.
  const coreTeam = new Map<string, string>();
  for (const t of teams) {
    for (const p of t.players ?? []) {
      if (!isCoreRole(p.role)) continue;
      const slug = p.slug?.trim() || slugify(p.nickname);
      const prev = coreTeam.get(slug);
      if (prev) {
        errors.push(
          `игрок «${slug}» действующий и в «${prev}», и в «${slugOf(t)}» — ` +
            `действующим можно быть только в одной команде, во вторую ставьте заменой`,
        );
      } else {
        coreTeam.set(slug, slugOf(t));
      }
    }
  }

  if (errors.length) throw new Error(`Конфликты составов — импорт отменён:\n  ${errors.join("\n  ")}`);
}

async function main() {
  const raw = await fs.readFile(file, "utf8").catch(() => {
    throw new Error(`Не найден файл составов: ${file}`);
  });
  const teams = JSON.parse(raw) as TeamInput[];
  if (!Array.isArray(teams)) throw new Error("Ожидался массив команд в корне файла");

  console.log(`Импорт составов${dry ? " (--dry, без записи)" : ""}: ${path.relative(process.cwd(), file)}`);
  await assertNoDuplicates(teams);
  for (const t of teams) await importTeam(t);

  // Кого убрали из состава в таблице — убираем и из состава в БД. Карточку игрока не трогаем:
  // человек остаётся в базе (со статой и фото), просто больше не числится за этой командой.
  if (!dry) {
    const slugs = teams.map((t) => slugOf(t));
    const spots = await prisma.rosterSpot.findMany({
      where: { team: { slug: { in: slugs } } },
      include: { team: { select: { slug: true } }, player: { select: { slug: true } } },
    });
    for (const s of spots) {
      if (seenSpots.has(`${s.teamId}:${s.playerId}`)) continue;
      await prisma.rosterSpot.delete({ where: { id: s.id } });
      stat.spotsGone++;
      warnings.push(`${s.team.slug}/${s.player.slug}: убран из состава — в таблице его больше нет`);
    }
  }

  console.log(
    `\nКоманды: +${stat.teamsNew} новых, ${stat.teamsUpd} обновлено` +
      `\nИгроки:  +${stat.playersNew} новых, ${stat.playersUpd} обновлено` +
      (stat.spotsGone ? `\nСостав:  -${stat.spotsGone} мест(а) убрано` : ""),
  );
  if (warnings.length) console.log(`\n⚠ ${warnings.length}:\n  ${warnings.join("\n  ")}`);
}

main()
  .catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
