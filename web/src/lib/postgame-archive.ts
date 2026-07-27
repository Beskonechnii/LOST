// Только сервер: архив выгруженных постгеймов — готовые PNG в public/uploads/postgame.
//
// Зачем так. Раньше архив хранил шапку матча в localStorage и по клику перезапрашивал отчёт из
// OpenDota — то есть хранил повод собрать картинку заново. Теперь храним сам результат: в работу
// уходят именно эти два PNG, и они должны быть под рукой, даже если OpenDota легла, а патч Доты
// с тех пор переименовал предметы. Матч при этом всё ещё можно перезапросить — id мы помним.
//
// Истина о том, что в архиве есть, — файлы на диске. JSON рядом хранит только подпись к ним:
// пропал .png — запись сама исчезнет с полки, чинить рассинхрон вручную не надо.

import fs from "node:fs/promises";
import path from "node:path";

export type ShotKind = "summary" | "players";
export const SHOT_KINDS: readonly ShotKind[] = ["summary", "players"];

/** Подпись к записи — из неё рисуется плашка на полке. Названия те, что были на картинке. */
export type ArchiveMeta = {
  matchId: string;
  source: "opendota" | "steam";
  radiant: string;
  dire: string;
  radiantScore: number;
  direScore: number;
  radiantWin: boolean;
  savedAt: number; // unix-мс последней выгрузки, для сортировки «свежие сверху»
};

export type ArchiveEntry = ArchiveMeta & {
  shots: Partial<Record<ShotKind, string>>; // kind → путь для <img>
};

const DIR = path.join(process.cwd(), "public", "uploads", "postgame");

/** id матча — только цифры: он идёт в имя файла, любой мусор здесь стал бы путём наружу. */
export function safeMatchId(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return /^\d{1,20}$/.test(s) ? s : null;
}

const shotFile = (matchId: string, kind: ShotKind) => `${matchId}-${kind}.png`;

export const shotUrl = (matchId: string, kind: ShotKind) => `/uploads/postgame/${shotFile(matchId, kind)}`;
export const shotPath = (matchId: string, kind: ShotKind) => path.join(DIR, shotFile(matchId, kind));
export const metaPath = (matchId: string) => path.join(DIR, `${matchId}.json`);

export const isShotKind = (v: unknown): v is ShotKind => SHOT_KINDS.includes(v as ShotKind);

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Положить картинку и обновить подпись. Повторная выгрузка того же матча перезаписывает файл. */
export async function saveShot(meta: ArchiveMeta, kind: ShotKind, bytes: Buffer): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(shotPath(meta.matchId, kind), bytes);
  await fs.writeFile(metaPath(meta.matchId), JSON.stringify(meta, null, 2), "utf8");
}

/** Вся полка, свежие сверху. Записи без картинок и с битой подписью молча пропускаем. */
export async function listEntries(): Promise<ArchiveEntry[]> {
  let files: string[];
  try {
    files = await fs.readdir(DIR);
  } catch {
    return []; // папки нет — архив просто пуст
  }

  const entries: ArchiveEntry[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const matchId = safeMatchId(path.basename(file, ".json"));
    if (!matchId) continue;

    let meta: ArchiveMeta;
    try {
      meta = JSON.parse(await fs.readFile(path.join(DIR, file), "utf8")) as ArchiveMeta;
    } catch {
      continue; // одна битая подпись не должна ронять весь листинг
    }

    const shots: Partial<Record<ShotKind, string>> = {};
    for (const kind of SHOT_KINDS) {
      if (await exists(shotPath(matchId, kind))) shots[kind] = shotUrl(matchId, kind);
    }
    if (Object.keys(shots).length === 0) continue; // подпись без картинок — показывать нечего

    entries.push({ ...meta, matchId, shots });
  }
  return entries.sort((a, b) => b.savedAt - a.savedAt);
}

/** Убрать матч с полки целиком: обе картинки и подпись. Чего нет — того не удаляем. */
export async function dropEntry(matchId: string): Promise<void> {
  const targets = [...SHOT_KINDS.map((k) => shotPath(matchId, k)), metaPath(matchId)];
  await Promise.all(targets.map((p) => fs.rm(p, { force: true })));
}
