// Только сервер: авто-обнаружение шрифтов из public/fonts. Кинул файл в папку — он появился в
// редакторе, дописывать реестр не нужно. Имя файла = имя семейства (оно же объявляется в @font-face).

import fs from "node:fs/promises";
import path from "node:path";
import type { FontDef } from "./fonts";

const EXT = new Set([".woff2", ".woff", ".ttf", ".otf"]);

/** Список файловых шрифтов из public/fonts. Пусто, если папки нет или в ней нет шрифтов. */
export async function discoverFonts(): Promise<FontDef[]> {
  const dir = path.join(process.cwd(), "public", "fonts");
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }
  return files
    .filter((f) => EXT.has(path.extname(f).toLowerCase()))
    .sort()
    .map((f) => {
      const base = path.basename(f, path.extname(f));
      return { label: prettify(base), family: base, src: `/fonts/${f}`, weight: guessWeight(base) };
    });
}

/** «druk-wide_bold» → «Druk Wide Bold» для подписи в списке. */
function prettify(base: string): string {
  return base
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Достаём вес из имени файла (bold/700/…), если он там есть — иначе не задаём. */
function guessWeight(base: string): string | undefined {
  const n = base.match(/\b([1-9]00)\b/);
  if (n) return n[1];
  const name = base.toLowerCase();
  if (/\b(thin|hairline)\b/.test(name)) return "100";
  if (/\bextralight|ultralight\b/.test(name)) return "200";
  if (/\blight\b/.test(name)) return "300";
  if (/\bmedium\b/.test(name)) return "500";
  if (/\bsemibold|demibold\b/.test(name)) return "600";
  if (/\bbold\b/.test(name)) return "700";
  if (/\bextrabold|ultrabold\b/.test(name)) return "800";
  if (/\bblack|heavy\b/.test(name)) return "900";
  return undefined;
}
