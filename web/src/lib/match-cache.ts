// Только сервер: кэш собранных отчётов по матчам — файл на матч в web/.cache/matches.
//
// Зачем. У OpenDota лимит порядка 60 запросов в минуту **на всех** — публичный трафик выест его
// и заодно уронит внутренний разбор. Спасает природа данных: отчёт по завершённому матчу
// неизменен, поэтому кэшируется навсегда и без инвалидации. Один популярный матч, куда бы на него
// ни сослались, стоит ровно одного запроса наружу.
//
// Почему файлы, а не память процесса: кэш должен переживать рестарт и деплой — иначе каждая
// выкладка начинает набивать лимит заново. Почему не БД: prisma/dev.db коммитится в репозиторий,
// а кэш — вывод, ему там не место (см. CLAUDE.md §8).
//
// Истина о содержимом — файлы: удалили папку → просто сходили в сеть заново.

import fs from "node:fs/promises";
import path from "node:path";
import type { MatchReport } from "./opendota";

export type MatchSource = "opendota" | "steam";

const DIR = path.join(process.cwd(), ".cache", "matches");

// Форма MatchReport меняется вместе с отчётом. Записи прошлой версии не читаем и не чиним —
// поднять номер здесь дешевле, чем разбирать, каким полем старый JSON отличается от нового.
const VERSION = 2; // 2 — в PlayerReport добавились варды и стаки (нужны архиву серий)

// Неразобранный матч ещё дозреет: OpenDota допарсит реплей и добавит график, тайминги и события.
// Держим такой отчёт недолго — он гасит шквал перезагрузок страницы, но не запирает пустой график.
const UNPARSED_TTL_MS = 60 * 60 * 1000; // час

type Entry = {
  version: number;
  savedAt: number;
  /** unix-мс, после которых запись протухла. null — отчёт финальный, живёт вечно. */
  staleAt: number | null;
  report: MatchReport;
};

/** id идёт в имя файла, поэтому пускаем только цифры — иначе это путь наружу из папки кэша. */
const isSafeId = (id: string) => /^\d{1,20}$/.test(id);

const file = (source: MatchSource, matchId: string) => path.join(DIR, `${source}-${matchId}.json`);

/**
 * Отчёт окончательный — меняться уже нечему.
 * OpenDota: только распарсенный, у остальных данные ещё появятся (график, тайминги, события).
 * Steam: любой завершённый — тех данных, которые дозревают, Valve и не отдаёт.
 */
export function isFinalReport(source: MatchSource, report: MatchReport): boolean {
  if (report.durationSeconds <= 0) return false; // матч не закончен
  return source === "steam" || report.parsed;
}

const staleAt = (source: MatchSource, report: MatchReport): number | null =>
  isFinalReport(source, report) ? null : Date.now() + UNPARSED_TTL_MS;

/** Готовый отчёт с полки. Нет, протух, битый или от прошлой версии формата — считаем, что нет. */
export async function readCachedReport(source: MatchSource, matchId: string): Promise<MatchReport | null> {
  if (!isSafeId(matchId)) return null;
  try {
    const entry = JSON.parse(await fs.readFile(file(source, matchId), "utf8")) as Entry;
    if (entry.version !== VERSION) return null;
    if (entry.staleAt != null && entry.staleAt < Date.now()) return null;
    return entry.report ?? null;
  } catch {
    return null; // кэш — ускорение, его поломка не должна ломать разбор матча
  }
}

/** Положить отчёт на полку. Ошибка записи (нет прав, кончилось место) не должна ронять ответ. */
export async function writeCachedReport(source: MatchSource, matchId: string, report: MatchReport): Promise<void> {
  if (!isSafeId(matchId)) return;
  const entry: Entry = { version: VERSION, savedAt: Date.now(), staleAt: staleAt(source, report), report };
  try {
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(file(source, matchId), JSON.stringify(entry), "utf8");
  } catch {
    // молча: отчёт уже собран и уходит клиенту, кэш — дело второе
  }
}
