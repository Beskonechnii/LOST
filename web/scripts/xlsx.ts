// Загрузка книги xlsx с диска или из гугл-таблицы — обёртка над чистым читателем src/lib/xlsx.ts.
// Разделены потому, что читатель нужен ещё и странице импорта в админке, а fs/fetch там ни к чему.

import fs from "node:fs/promises";
import path from "node:path";
import { readWorkbook, type Sheet } from "../src/lib/xlsx";

export { readWorkbook, asInt } from "../src/lib/xlsx";
export type { Cell, Grid, Sheet } from "../src/lib/xlsx";

/** Источник: путь к локальному .xlsx, ссылка на гугл-таблицу или голый id таблицы. */
export async function loadWorkbook(src: string): Promise<Sheet[]> {
  let buf: Uint8Array;
  if (/\.xlsx$/i.test(src) && !/^https?:/.test(src)) {
    buf = new Uint8Array(await fs.readFile(path.resolve(src)));
  } else {
    const id = src.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1] ?? src;
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`);
    if (!res.ok) throw new Error(`Не скачать таблицу (${res.status}). Открыт ли доступ по ссылке?`);
    buf = new Uint8Array(await res.arrayBuffer());
  }
  return readWorkbook(buf);
}

