"use client";

import { useMemo, useRef, useState } from "react";
import { domToPng } from "modern-screenshot";
import { Canvas } from "@/studio/Canvas";
import { getTemplate } from "@/studio/registry";
import { resolvePayload, type Refs } from "@/studio/resolve";
import {
  emptyPayload,
  emptyRow,
  type FieldDef,
  type MatchOption,
  type RawPayload,
  type RawRow,
  type TemplateDef,
} from "@/studio/types";
import { Label, SelectField, TextField } from "../../../_components/form";

// Мастер генерации: форма строится из schema шаблона, справа — живое превью,
// снизу — экспорт PNG в натуральном размере и сохранение payload в историю.

export function Wizard(props: { templateId: string; refs: Refs; matches: MatchOption[]; initial?: RawPayload }) {
  const template = getTemplate(props.templateId);
  if (!template) return <p className="text-rose-400">Шаблон «{props.templateId}» не найден.</p>;
  return <WizardForm {...props} template={template} />;
}

function WizardForm({
  template,
  refs,
  matches,
  initial,
}: {
  template: TemplateDef;
  refs: Refs;
  matches: MatchOption[];
  initial?: RawPayload;
}) {
  const [payload, setPayload] = useState<RawPayload>(() => initial ?? emptyPayload(template.fields));
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const node = useRef<HTMLDivElement>(null);

  const data = useMemo(() => resolvePayload(template.fields, payload, refs), [template, payload, refs]);
  const { size, Render } = template;

  const setField = (key: string, value: string) => setPayload((p) => ({ ...p, [key]: value }));
  const setRow = (key: string, i: number, sub: string, value: string) =>
    setPayload((p) => {
      const rows = [...((p[key] as RawRow[]) ?? [])];
      rows[i] = { ...rows[i], [sub]: value };
      return { ...p, [key]: rows };
    });

  /** Автозаполнение из матча в БД: верхнеуровневые поля или новая строка группы. */
  function prefill(m: MatchOption, groupKey?: string) {
    const fill: RawRow = {
      teamA: m.teamAId ? String(m.teamAId) : "",
      teamB: m.teamBId ? String(m.teamBId) : "",
      time: m.time,
      division: m.division,
    };
    setPayload((p) => {
      if (!groupKey) return { ...p, ...fill };
      const group = template.fields.find((f) => f.key === groupKey);
      const blank = group?.kind === "group" ? emptyRow(group.fields) : {};
      const rows = [...((p[groupKey] as RawRow[]) ?? [])];
      const max = group?.kind === "group" ? group.max : 1;
      const next = { ...blank, ...fill };
      const emptyIdx = rows.findIndex((r) => !r.teamA && !r.teamB);
      if (emptyIdx >= 0) rows[emptyIdx] = next;
      else if (rows.length < max) rows.push(next);
      else rows[rows.length - 1] = next;
      return { ...p, [groupKey]: rows };
    });
  }

  async function exportPng() {
    if (!node.current) return;
    setBusy(true);
    try {
      // масштаб превью снимаем на клоне — PNG выходит ровно size.w × size.h
      const url = await domToPng(node.current, {
        width: size.w,
        height: size.h,
        style: { transform: "none" },
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${template.id}-${Date.now()}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setSaved(null);
    const res = await fetch("/api/studio/renders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateId: template.id, payload }),
    });
    setSaved(res.ok ? "Сохранено в историю" : "Не удалось сохранить");
  }

  const groupKey = template.fields.find((f) => f.kind === "group")?.key;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
      <div className="space-y-5">
        {matches.length > 0 && (
          <div className="rounded border border-neutral-800 bg-neutral-900/40 p-3">
            <Label>Взять из матча</Label>
            <select
              className="w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-violet-500"
              defaultValue=""
              onChange={(e) => {
                const m = matches.find((x) => String(x.id) === e.target.value);
                if (m) prefill(m, groupKey);
                e.currentTarget.value = "";
              }}
            >
              <option value="">— выбрать матч —</option>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {template.fields.map((f) =>
          f.kind === "group" ? (
            <GroupField
              key={f.key}
              field={f}
              rows={(payload[f.key] as RawRow[]) ?? []}
              refs={refs}
              onChange={(i, sub, v) => setRow(f.key, i, sub, v)}
              onAdd={() =>
                setPayload((p) => ({ ...p, [f.key]: [...((p[f.key] as RawRow[]) ?? []), emptyRow(f.fields)] }))
              }
              onRemove={(i) =>
                setPayload((p) => ({ ...p, [f.key]: ((p[f.key] as RawRow[]) ?? []).filter((_, j) => j !== i) }))
              }
            />
          ) : (
            <PlainField
              key={f.key}
              field={f}
              value={(payload[f.key] as string) ?? ""}
              refs={refs}
              onChange={(v) => setField(f.key, v)}
            />
          ),
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void exportPng()}
            className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {busy ? "Готовлю PNG…" : `Скачать PNG ${size.w}×${size.h}`}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            className="rounded border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500"
          >
            Сохранить в историю
          </button>
          {saved && <span className="text-sm text-neutral-400">{saved}</span>}
        </div>
      </div>

      {/* превью держим в поле зрения: липкая колонка ростом не выше экрана */}
      <div className="lg:sticky lg:top-6">
        <div className="h-[45vh] min-h-[220px] lg:h-[calc(100vh-11rem)]">
          <Canvas w={size.w} h={size.h} nodeRef={node}>
            <Render data={data} />
          </Canvas>
        </div>
        <p className="mt-2 text-center text-xs text-neutral-600">
          Превью масштабировано; PNG выгружается в натуральных {size.w}×{size.h}.
        </p>
      </div>
    </div>
  );
}

function PlainField({
  field,
  value,
  refs,
  onChange,
}: {
  field: FieldDef;
  value: string;
  refs: Refs;
  onChange: (v: string) => void;
}) {
  if (field.kind === "team") {
    return (
      <SelectField
        label={field.label}
        value={value}
        onChange={onChange}
        options={[{ value: "", label: "— команда —" }, ...refs.teams.map((t) => ({ value: String(t.id), label: t.name }))]}
      />
    );
  }
  if (field.kind === "player") {
    return (
      <SelectField
        label={field.label}
        value={value}
        onChange={onChange}
        options={[
          { value: "", label: "— игрок —" },
          ...refs.players.map((p) => ({ value: String(p.id), label: p.teamName ? `${p.nickname} (${p.teamName})` : p.nickname })),
        ]}
      />
    );
  }
  if (field.kind === "select") {
    return (
      <SelectField
        label={field.label}
        value={value}
        onChange={onChange}
        options={field.options.map((o) => ({ value: o, label: o }))}
      />
    );
  }
  if (field.kind === "text") {
    return <TextField label={field.label} value={value} onChange={onChange} placeholder={field.placeholder} />;
  }
  return null;
}

function GroupField({
  field,
  rows,
  refs,
  onChange,
  onAdd,
  onRemove,
}: {
  field: Extract<FieldDef, { kind: "group" }>;
  rows: RawRow[];
  refs: Refs;
  onChange: (i: number, sub: string, v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{field.label}</Label>
        {rows.length < field.max && (
          <button type="button" onClick={onAdd} className="text-xs text-violet-400 hover:underline">
            + добавить
          </button>
        )}
      </div>
      {rows.map((row, i) => (
        <div key={i} className="space-y-3 rounded border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>#{i + 1}</span>
            <button type="button" onClick={() => onRemove(i)} className="hover:text-rose-400">
              убрать
            </button>
          </div>
          {field.fields.map((sub) => (
            <PlainField
              key={sub.key}
              field={sub}
              value={row[sub.key] ?? ""}
              refs={refs}
              onChange={(v) => onChange(i, sub.key, v)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
