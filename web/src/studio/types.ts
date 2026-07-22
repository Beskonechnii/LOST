// Контракт шаблона графики. Шаблон = размер холста + декларативная схема полей + компонент рендера.
// Форма мастера строится из schema автоматически (src/app/studio/_components/wizard.tsx),
// поэтому новый шаблон = файл в templates/ + строка в registry.ts, без новых страниц и форм.

import type { ComponentType } from "react";

export type TeamRef = {
  id: number;
  name: string;
  tag: string | null;
  group: string | null;
  color: string | null;
  logo: string | null;
  wordmark: string | null;
  photo: string | null;
};

export type PlayerRef = {
  id: number;
  nickname: string;
  photo: string | null;
  teamName: string | null;
};

export type FieldDef =
  | { kind: "text"; key: string; label: string; default?: string; placeholder?: string }
  | { kind: "select"; key: string; label: string; options: string[]; default?: string }
  | { kind: "team"; key: string; label: string }
  | { kind: "player"; key: string; label: string }
  | { kind: "group"; key: string; label: string; max: number; fields: FieldDef[] };

/** Что хранится в форме и в БД (Render.payload): ссылки на команды/игроков — id строкой. */
export type RawValue = string | RawRow[];
export type RawRow = Record<string, string>;
export type RawPayload = Record<string, RawValue>;

/** Что приходит в компонент рендера: team/player уже развёрнуты в объекты. */
export type Scalar = string | TeamRef | PlayerRef | null;
export type ResolvedRow = Record<string, Scalar>;
export type Value = Scalar | ResolvedRow[];
export type Data = Record<string, Value>;

export type TemplateDef = {
  id: string;
  title: string;
  description: string;
  size: { w: number; h: number };
  fields: FieldDef[];
  Render: ComponentType<{ data: Data }>;
};

/** Значения по умолчанию для пустой формы. */
export function emptyPayload(fields: FieldDef[]): RawPayload {
  const out: RawPayload = {};
  for (const f of fields) {
    if (f.kind === "group") out[f.key] = [emptyRow(f.fields)];
    else if (f.kind === "text" || f.kind === "select") out[f.key] = f.default ?? "";
    else out[f.key] = "";
  }
  return out;
}

export function emptyRow(fields: FieldDef[]): RawRow {
  const row: RawRow = {};
  for (const f of fields) {
    if (f.kind === "group") continue; // вложенные группы не поддерживаем — не нужны шаблонам
    row[f.key] = f.kind === "text" || f.kind === "select" ? (f.default ?? "") : "";
  }
  return row;
}

/** Хелперы чтения в компонентах рендера — без «as» на каждой строке. */
export const asText = (v: Value | undefined): string => (typeof v === "string" ? v : "");
export const asTeam = (v: Value | undefined): TeamRef | null =>
  v && typeof v === "object" && !Array.isArray(v) && "name" in v ? (v as TeamRef) : null;
export const asPlayer = (v: Value | undefined): PlayerRef | null =>
  v && typeof v === "object" && !Array.isArray(v) && "nickname" in v ? (v as PlayerRef) : null;
export const asRows = (v: Value | undefined): ResolvedRow[] => (Array.isArray(v) ? v : []);
