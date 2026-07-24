"use client";

import { useSyncExternalStore } from "react";

// Архив последних разобранных матчей. Живёт в localStorage браузера, а не в БД:
// это удобство оператора (быстро вернуться к матчу), а не данные лиги — в базе им не место.
// Хранится только шапка: по клику отчёт перезапрашивается из того же источника.

export type HistoryEntry = {
  matchId: string;
  source: "opendota" | "steam";
  savedAt: number; // unix-мс, для сортировки «свежие сверху»
  radiant: string; // название стороны на момент разбора (уже с подстановкой команд лиги)
  dire: string;
  radiantScore: number;
  direScore: number;
  radiantWin: boolean;
};

const KEY = "lost:match-history";
const LIMIT = 12; // архив компактный: старое вытесняется, чистить руками не нужно

function read(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return []; // битый/чужой JSON в ключе не должен ронять страницу
  }
}

// --- Внешнее хранилище для useSyncExternalStore ---
// Снапшот кэшируется: React сравнивает результат по ссылке, новый массив на каждый вызов
// уводил бы рендер в цикл. Сбрасываем кэш только когда архив реально поменялся.
const EMPTY: HistoryEntry[] = [];
let cache: HistoryEntry[] | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function onStorage(e: StorageEvent) {
  // Соседняя вкладка правила архив — перечитываем.
  if (e.key === null || e.key === KEY) {
    cache = null;
    emit();
  }
}
function subscribe(l: () => void) {
  if (!listeners.size) window.addEventListener("storage", onStorage);
  listeners.add(l);
  return () => {
    listeners.delete(l);
    if (!listeners.size) window.removeEventListener("storage", onStorage);
  };
}
const getSnapshot = () => (cache ??= read());
// На сервере localStorage нет: первый рендер всегда с пустым архивом, иначе разъедется гидрация.
const getServerSnapshot = () => EMPTY;

export function useHistory(): HistoryEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function write(list: HistoryEntry[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // приватный режим или переполнение — молча живём без архива
  }
  cache = list;
  emit();
}

// Один и тот же матч не плодится: повторный разбор поднимает запись наверх и обновляет её.
export function pushHistory(entry: HistoryEntry) {
  write([entry, ...getSnapshot().filter((e) => e.matchId !== entry.matchId)].slice(0, LIMIT));
}

export function dropHistory(matchId: string) {
  write(getSnapshot().filter((e) => e.matchId !== matchId));
}

export function clearHistory() {
  write([]);
}

export function MatchHistory({ items, onOpen }: { items: HistoryEntry[]; onOpen: (e: HistoryEntry) => void }) {
  if (!items.length) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="mr-1 text-neutral-500">Архив</span>
      {items.map((e) => {
        const win = e.radiantWin ? e.radiant : e.dire;
        return (
          <span
            key={e.matchId}
            className="inline-flex items-center rounded-md border border-neutral-800 bg-neutral-900/60 pl-2 text-neutral-400 hover:border-neutral-600"
          >
            <button
              onClick={() => onOpen(e)}
              title={`#${e.matchId} · победа: ${win} · источник: ${e.source === "steam" ? "Steam" : "OpenDota"}`}
              className="py-1 pr-1.5 hover:text-neutral-100"
            >
              <span className={e.radiantWin ? "text-neutral-200" : ""}>{e.radiant}</span>
              <span className="mx-1 tabular-nums text-neutral-500">
                {e.radiantScore}–{e.direScore}
              </span>
              <span className={e.radiantWin ? "" : "text-neutral-200"}>{e.dire}</span>
              {/* Источник помечаем только у Steam: OpenDota — путь по умолчанию, метка была бы шумом. */}
              {e.source === "steam" && <span className="ml-1.5 text-[10px] text-neutral-500">STEAM</span>}
            </button>
            <button
              onClick={() => dropHistory(e.matchId)}
              title="Убрать из архива"
              aria-label={`Убрать матч ${e.matchId} из архива`}
              className="px-1.5 py-1 text-neutral-600 hover:text-rose-400"
            >
              ✕
            </button>
          </span>
        );
      })}
      <button onClick={clearHistory} className="ml-1 px-1 text-neutral-600 hover:text-rose-400">
        очистить
      </button>
    </div>
  );
}
