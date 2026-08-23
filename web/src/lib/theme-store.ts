// Только сервер: чтение и запись темы UI в data/theme.json. Файл коммитится и едет между
// устройствами (как data/snapshot.json). Чистая логика темы (типы, дефолты, сборка CSS) — в
// src/lib/theme.ts, здесь — единственное место, которое трогает диск.

import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_THEME, normalizeTheme, type Theme } from "@/lib/theme";

const FILE = path.join(process.cwd(), "data", "theme.json");

/** Текущая тема с диска. Файла нет или он битый → дефолт (сайт выглядит как из коробки). */
export async function readTheme(): Promise<Theme> {
  try {
    const raw = JSON.parse(await fs.readFile(FILE, "utf8"));
    return normalizeTheme(raw);
  } catch {
    return { ...DEFAULT_THEME };
  }
}

/** Записать тему (уже нормализованную) в data/theme.json человекочитаемым JSON. */
export async function writeTheme(theme: Theme): Promise<void> {
  const clean = normalizeTheme(theme);
  await fs.writeFile(FILE, JSON.stringify(clean, null, 2) + "\n", "utf8");
}
