// Импорт картинок профилей: локальная папка → public/uploads + пути в БД.
// Сопоставление по имени файла = slug команды/игрока (регистр и расширение свободные).
//
// Запуск (из web/):
//   npx tsx scripts/import-media.ts --from "D:\LOST\media"
//     --dry   только показать, что куда ляжет
//
// Структура источника (подпапки необязательны, всё лежащее в корне трактуется как logo/photo):
//   teams/logo/<slug>.png       → Team.logo
//   teams/wordmark/<slug>.png   → Team.wordmark
//   teams/photo/<slug>.jpg      → Team.photo
//   players/<slug>.jpg          → Player.photo
//
// Несопоставленное (файл без слага, слаг без файла) печатается списком — добить руками в /studio.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { uploadUrl } from "../src/lib/profiles";

const EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

const here = path.dirname(fileURLToPath(import.meta.url)); // web/scripts
const uploadsDir = path.resolve(here, "../public/uploads");

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const from = args[args.indexOf("--from") + 1];
if (!args.includes("--from") || !from) {
  console.error('Укажите папку-источник: npx tsx scripts/import-media.ts --from "<путь>"');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

// Какое поле в БД обновляем — по подпапке источника.
type Target = { kind: "teams" | "players"; field: "logo" | "wordmark" | "photo" };
const TARGETS: Record<string, Target> = {
  "teams/logo": { kind: "teams", field: "logo" },
  "teams/wordmark": { kind: "teams", field: "wordmark" },
  "teams/photo": { kind: "teams", field: "photo" },
  teams: { kind: "teams", field: "logo" },
  players: { kind: "players", field: "photo" },
  "players/photo": { kind: "players", field: "photo" },
};

type Found = { target: Target; slug: string; file: string };

const unmatchedFiles: string[] = [];
const stat = { copied: 0, skipped: 0 };

/** Обходим источник и раскладываем файлы по целям (по относительному пути папки). */
async function scan(dir: string, rel = ""): Promise<Found[]> {
  const out: Found[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await scan(full, rel ? `${rel}/${e.name}` : e.name)));
      continue;
    }
    const ext = path.extname(e.name).toLowerCase();
    if (!EXT.has(ext)) continue;

    const target = TARGETS[rel.toLowerCase()];
    if (!target) {
      unmatchedFiles.push(`${rel || "."}/${e.name} — непонятная папка, ожидались teams/… или players/…`);
      continue;
    }
    out.push({ target, slug: path.basename(e.name, ext).toLowerCase(), file: full });
  }
  return out;
}

async function main() {
  const src = path.resolve(from);
  const found = await scan(src);

  const teams = await prisma.team.findMany({ select: { id: true, slug: true } });
  const players = await prisma.player.findMany({ select: { id: true, slug: true } });
  const idBySlug = {
    teams: new Map(teams.map((t) => [t.slug, t.id])),
    players: new Map(players.map((p) => [p.slug, p.id])),
  };
  const touched = { teams: new Set<string>(), players: new Set<string>() };

  for (const kind of ["teams", "players"] as const) {
    await fs.mkdir(path.join(uploadsDir, kind), { recursive: true });
  }

  for (const f of found) {
    const id = idBySlug[f.target.kind].get(f.slug);
    if (id === undefined) {
      unmatchedFiles.push(`${path.basename(f.file)} — нет ${f.target.kind === "teams" ? "команды" : "игрока"} со слагом «${f.slug}»`);
      stat.skipped++;
      continue;
    }

    const name = `${f.slug}-${f.target.field}${path.extname(f.file).toLowerCase()}`;
    const dest = path.join(uploadsDir, f.target.kind, name);
    const url = uploadUrl(f.target.kind, name);

    if (dry) {
      console.log(`  ${path.basename(f.file)} → ${url}  (${f.target.kind}.${f.target.field})`);
    } else {
      await fs.copyFile(f.file, dest);
      if (f.target.kind === "teams") {
        const field = f.target.field;
        await prisma.team.update({
          where: { id },
          data: field === "logo" ? { logo: url } : field === "wordmark" ? { wordmark: url } : { photo: url },
        });
      } else {
        await prisma.player.update({ where: { id }, data: { photo: url } });
      }
    }
    touched[f.target.kind].add(f.slug);
    stat.copied++;
  }

  const missTeams = teams.filter((t) => !touched.teams.has(t.slug)).map((t) => t.slug);
  const missPlayers = players.filter((p) => !touched.players.has(p.slug)).map((p) => p.slug);

  console.log(`\nСкопировано: ${stat.copied}${dry ? " (--dry, без записи)" : ""}, пропущено: ${stat.skipped}`);
  if (unmatchedFiles.length) console.log(`\nФайлы без пары (${unmatchedFiles.length}):\n  ${unmatchedFiles.join("\n  ")}`);
  if (missTeams.length) console.log(`\nКоманды без картинок: ${missTeams.join(", ")}`);
  if (missPlayers.length) console.log(`\nИгроки без фото: ${missPlayers.join(", ")}`);
}

main()
  .catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
