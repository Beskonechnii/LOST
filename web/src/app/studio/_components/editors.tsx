"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageField, SaveButton, SelectField, TextField, Label } from "./ui";

// Формы профилей. Значения приходят из серверной страницы, изменения уходят в /api/studio/*.

type TeamForm = {
  name: string;
  tag: string;
  group: string;
  color: string;
  logo: string | null;
  wordmark: string | null;
  photo: string | null;
};

export function TeamEditor({ id, initial }: { id: number; initial: TeamForm }) {
  const [v, setV] = useState(initial);
  const set = <K extends keyof TeamForm>(k: K, val: TeamForm[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Название" value={v.name} onChange={(x) => set("name", x)} />
        <TextField label="Тег" value={v.tag} onChange={(x) => set("tag", x)} placeholder="MLK" />
        <TextField label="Дивизион / группа" value={v.group} onChange={(x) => set("group", x)} placeholder="Division 1" />
        <label className="block">
          <Label>Акцентный цвет</Label>
          <div className="flex gap-2">
            <input
              type="color"
              value={v.color || "#a855f7"}
              onChange={(e) => set("color", e.target.value)}
              className="h-10 w-12 rounded border border-neutral-800 bg-neutral-900"
            />
            <input
              className="w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-violet-500"
              value={v.color}
              placeholder="#A855F7"
              onChange={(e) => set("color", e.target.value)}
            />
          </div>
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <ImageField label="Логотип" kind="teams" value={v.logo} onChange={(x) => set("logo", x)} hint="Эмблема, PNG с прозрачностью" />
        <ImageField label="Wordmark" kind="teams" value={v.wordmark} onChange={(x) => set("wordmark", x)} hint="Надпись-граффити для анонсов" />
        <ImageField label="Фото команды" kind="teams" value={v.photo} onChange={(x) => set("photo", x)} hint="Кадр в рамку VS-анонса" />
      </div>

      <SaveButton url={`/api/studio/teams/${id}`} data={v} />
    </div>
  );
}

type PlayerForm = {
  nickname: string;
  realName: string;
  accountId: string;
  position: string;
  isCaptain: boolean;
  telegram: string;
  photo: string | null;
  teamId: string;
};

export function PlayerEditor({
  id,
  initial,
  teams,
}: {
  id: number;
  initial: PlayerForm;
  teams: { id: number; name: string }[];
}) {
  const [v, setV] = useState(initial);
  const set = <K extends keyof PlayerForm>(k: K, val: PlayerForm[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Ник" value={v.nickname} onChange={(x) => set("nickname", x)} />
        <TextField label="Имя" value={v.realName} onChange={(x) => set("realName", x)} />
        <SelectField
          label="Команда"
          value={v.teamId}
          onChange={(x) => set("teamId", x)}
          options={[{ value: "", label: "— без команды —" }, ...teams.map((t) => ({ value: String(t.id), label: t.name }))]}
        />
        <SelectField
          label="Позиция"
          value={v.position}
          onChange={(x) => set("position", x)}
          options={[{ value: "", label: "—" }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `Позиция ${n}` }))]}
        />
        <TextField label="Dota account_id" value={v.accountId} onChange={(x) => set("accountId", x)} placeholder="123456789" />
        <TextField label="Telegram" value={v.telegram} onChange={(x) => set("telegram", x)} placeholder="@nick" />
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={v.isCaptain} onChange={(e) => set("isCaptain", e.target.checked)} />
        Капитан
      </label>

      <ImageField label="Фото" kind="players" value={v.photo} onChange={(x) => set("photo", x)} hint="Портрет для плашек и анонсов" />

      <SaveButton url={`/api/studio/players/${id}`} data={{ ...v, position: v.position === "" ? null : Number(v.position) }} />
    </div>
  );
}

/** Создание сущности: минимум полей, дальше — в профиле. */
export function CreateForm({
  url,
  fields,
  submitLabel,
}: {
  url: string;
  fields: { key: string; label: string; placeholder?: string }[];
  submitLabel: string;
}) {
  const router = useRouter();
  const [v, setV] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(v),
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Не удалось создать");
      return;
    }
    setV({});
    router.refresh();
  }

  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="flex flex-wrap items-end gap-3">
        {fields.map((f) => (
          <div key={f.key} className="w-48">
            <TextField
              label={f.label}
              value={v[f.key] ?? ""}
              placeholder={f.placeholder}
              onChange={(x) => setV((p) => ({ ...p, [f.key]: x }))}
            />
          </div>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {busy ? "…" : submitLabel}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
    </div>
  );
}
