// Минимальный читатель xlsx для скриптов импорта: строки, значения ячеек и гиперссылки.
// Полноценный парсер (форматы, формулы, даты) не нужен — таблицы мы только читаем.
//
// Почему xlsx, а не CSV: ссылки на профили в таблицах лиги — это гиперссылки ячеек,
// в CSV-экспорт они не попадают вообще. Общий код для sheet-to-roster.ts и import-crm.ts.

import fs from "node:fs/promises";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";

export type Cell = { text: string; href: string | null };
export type Grid = Cell[][]; // [строка][колонка]
export type Sheet = { name: string; grid: Grid };

const unescapeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");

/** «B12» → { row: 11, col: 1 } (нумерация с нуля). */
function refToRc(ref: string) {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(m[2]) - 1, col: col - 1 };
}

function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((si) =>
    [...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => unescapeXml(t[1])).join(""),
  );
}

function parseSheet(xml: string, shared: string[], rels: Map<string, string>): Grid {
  // ref → внешний адрес гиперссылки
  const links = new Map<string, string>();
  for (const h of xml.matchAll(/<hyperlink[^>]*\/>/g)) {
    const ref = h[0].match(/ref="([^"]+)"/)?.[1];
    const rid = h[0].match(/r:id="([^"]+)"/)?.[1];
    const target = rid ? rels.get(rid) : undefined;
    if (ref && target) links.set(ref.split(":")[0], target);
  }

  const grid: Grid = [];
  // пустые ячейки самозакрыты (<c r="A2" s="2"/>) — их нужно отличать от <c …>…</c>,
  // иначе «жадный» разбор съедает соседнюю ячейку и колонки уезжают
  for (const c of xml.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = c[1];
    const ref = attrs.match(/r="([^"]+)"/)?.[1];
    const rc = ref ? refToRc(ref) : null;
    if (!rc) continue;

    const type = attrs.match(/t="([^"]+)"/)?.[1];
    const body = c[2] ?? "";
    const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
    const inline = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => unescapeXml(t[1])).join("");
    const text = type === "s" ? (shared[Number(raw)] ?? "") : type === "inlineStr" ? inline : unescapeXml(raw);

    (grid[rc.row] ??= [])[rc.col] = { text: text.trim(), href: links.get(ref!) ?? null };
  }
  return grid;
}

/** Листы книги с их названиями — по названию скрипты понимают, что на вкладке лежит. */
export function readWorkbook(buf: Uint8Array): Sheet[] {
  const files = unzipSync(buf);
  const shared = files["xl/sharedStrings.xml"] ? parseSharedStrings(strFromU8(files["xl/sharedStrings.xml"])) : [];

  // порядок <sheet> в workbook.xml = порядок вкладок; rId → файл листа
  const wbRels = new Map<string, string>();
  for (const r of strFromU8(files["xl/_rels/workbook.xml.rels"]).matchAll(/<Relationship([^>]*)\/>/g)) {
    const id = r[1].match(/Id="([^"]+)"/)?.[1];
    const target = r[1].match(/Target="([^"]+)"/)?.[1];
    if (id && target) wbRels.set(id, target.replace(/^\/?xl\//, ""));
  }

  const out: Sheet[] = [];
  for (const s of strFromU8(files["xl/workbook.xml"]).matchAll(/<sheet\s([^>]*)\/?>/g)) {
    const name = unescapeXml(s[1].match(/name="([^"]+)"/)?.[1] ?? "");
    const file = `xl/${wbRels.get(s[1].match(/r:id="([^"]+)"/)?.[1] ?? "") ?? ""}`;
    if (!files[file]) continue;

    const relFile = files[file.replace("worksheets/", "worksheets/_rels/") + ".rels"];
    const rels = new Map<string, string>();
    if (relFile) {
      for (const r of strFromU8(relFile).matchAll(/<Relationship([^>]*)\/>/g)) {
        const id = r[1].match(/Id="([^"]+)"/)?.[1];
        const target = r[1].match(/Target="([^"]+)"/)?.[1];
        if (id && target) rels.set(id, unescapeXml(target));
      }
    }
    out.push({ name, grid: parseSheet(strFromU8(files[file]), shared, rels) });
  }
  return out;
}

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

/** Числа в xlsx хранятся как «1.0» — приводим к «1», чтобы сравнивать с ролями и номерами. */
export const asInt = (s: string) => (/^\d+(\.0+)?$/.test(s) ? String(Number(s)) : s);
