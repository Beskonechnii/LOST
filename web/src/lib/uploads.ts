// Только сервер: разрешение картинок профилей с фолбэком на файл по слагу.
//
// Зачем. Пути к лого/фото лежат в Team.logo и т.п., но dev.db в .gitignore — на чистом клоне
// поля пустые, хотя сами файлы в репозитории есть (public/uploads/, кладёт scripts/import-media.ts).
// Поэтому: поле в БД — истина, а если его нет, ищем файл по конвенции «<slug>-<field>.<ext>».
// Расширение заранее неизвестно (png/jpg/webp), поэтому смотрим реальный листинг папки,
// а не угадываем — иначе получили бы битую картинку вместо честной заглушки.

import fs from "node:fs/promises";
import path from "node:path";
import { uploadUrl, type UploadKind } from "@/lib/profiles";

type UploadField = "logo" | "wordmark" | "photo";

// Листинг папки кэшируется: страницы ростера и студии зовут это на каждую команду.
// Инвалидация — invalidateUploads() из /api/roster/upload, иначе свежая загрузка не видна до рестарта.
const cache = new Map<UploadKind, Promise<Map<string, string>>>();

async function listing(kind: UploadKind): Promise<Map<string, string>> {
  const dir = path.join(process.cwd(), "public", "uploads", kind);
  const byBase = new Map<string, string>();
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return byBase; // папки нет — фолбэка просто не будет
  }
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) continue;
    byBase.set(path.basename(file, path.extname(file)).toLowerCase(), file);
  }
  return byBase;
}

function files(kind: UploadKind) {
  const hit = cache.get(kind);
  if (hit) return hit;
  const fresh = listing(kind);
  cache.set(kind, fresh);
  return fresh;
}

/** Сбросить кэш листинга — после записи нового файла в public/uploads. */
export function invalidateUploads(kind?: UploadKind) {
  if (kind) cache.delete(kind);
  else cache.clear();
}

/** Путь к картинке: значение из БД, иначе файл «<slug>-<field>» из public/uploads, иначе null. */
export async function resolveUpload(
  kind: UploadKind,
  slug: string,
  field: UploadField,
  stored: string | null,
): Promise<string | null> {
  if (stored) return stored;
  const file = (await files(kind)).get(`${slug}-${field}`.toLowerCase());
  return file ? uploadUrl(kind, file) : null;
}

/** Команда с подставленными лого/wordmark/фото. Поля из БД перекрывают файлы по слагу. */
export async function withTeamUploads<T extends { slug: string; logo: string | null; wordmark?: string | null; photo?: string | null }>(
  team: T,
): Promise<T> {
  const [logo, wordmark, photo] = await Promise.all([
    resolveUpload("teams", team.slug, "logo", team.logo),
    resolveUpload("teams", team.slug, "wordmark", team.wordmark ?? null),
    resolveUpload("teams", team.slug, "photo", team.photo ?? null),
  ]);
  return { ...team, logo, ...("wordmark" in team ? { wordmark } : {}), ...("photo" in team ? { photo } : {}) };
}

/** Фото игрока с фолбэком по слагу. */
export async function withPlayerUploads<T extends { slug: string; photo: string | null }>(player: T): Promise<T> {
  return { ...player, photo: await resolveUpload("players", player.slug, "photo", player.photo) };
}
