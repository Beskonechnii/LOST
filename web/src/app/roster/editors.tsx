"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageField, SaveButton, SelectField, TextField, Label } from "../_components/form";
import { ROLES } from "@/lib/roles";

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

      <SaveButton url={`/api/roster/teams/${id}`} data={v} />
    </div>
  );
}

// Карточка игрока — про человека. Команда, роль и капитанство лежат на месте в составе,
// потому что у одного человека их может быть несколько (см. SpotsEditor ниже).
type PlayerForm = {
  nickname: string;
  realName: string;
  accountId: string;
  mmr: string;
  telegram: string;
  photo: string | null;
};

export function PlayerEditor({ id, initial }: { id: number; initial: PlayerForm }) {
  const [v, setV] = useState(initial);
  const set = <K extends keyof PlayerForm>(k: K, val: PlayerForm[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Ник" value={v.nickname} onChange={(x) => set("nickname", x)} />
        <TextField label="Имя" value={v.realName} onChange={(x) => set("realName", x)} />
        <TextField label="Dota account_id" value={v.accountId} onChange={(x) => set("accountId", x)} placeholder="123456789" />
        <TextField label="MMR" value={v.mmr} onChange={(x) => set("mmr", x)} placeholder="7000" />
        <TextField label="Telegram" value={v.telegram} onChange={(x) => set("telegram", x)} placeholder="@nick" />
      </div>

      <ImageField label="Фото" kind="players" value={v.photo} onChange={(x) => set("photo", x)} hint="Портрет для плашек и анонсов" />

      <SaveButton url={`/api/roster/players/${id}`} data={v} />
    </div>
  );
}

export type SpotView = { id: number; teamId: number; teamName: string; role: string; isCaptain: boolean };

const ROLE_OPTIONS = [
  { value: "", label: "— не задана —" },
  ...ROLES.map((r) => ({ value: r.key, label: r.position ? `${r.label} (поз. ${r.position})` : r.label })),
];

/**
 * Места игрока в составах. Их может быть несколько: действующим — только в одной команде,
 * заменой или тренером — где угодно. Правило проверяет сервер, здесь только показываем отказ.
 */
export function SpotsEditor({
  playerId,
  spots,
  teams,
}: {
  playerId: number;
  spots: SpotView[];
  teams: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newTeam, setNewTeam] = useState("");
  const [newRole, setNewRole] = useState("standin");

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "Не удалось сохранить");
      router.refresh(); // откатываем селект к тому, что реально в базе
      return;
    }
    router.refresh();
  }

  const free = teams.filter((t) => !spots.some((s) => s.teamId === t.id));

  return (
    <div className="space-y-3">
      {spots.length === 0 && <p className="text-sm text-neutral-500">Игрок не числится ни в одном составе.</p>}

      {spots.map((s) => (
        <div key={s.id} className="flex flex-wrap items-end gap-3 rounded border border-neutral-800 bg-neutral-900/40 p-3">
          <div className="min-w-40 flex-1 text-sm font-medium text-neutral-200">{s.teamName}</div>
          <div className="w-56">
            <SelectField
              label="Роль"
              value={s.role}
              onChange={(x) => void send(`/api/roster/spots/${s.id}`, "PATCH", { role: x })}
              options={ROLE_OPTIONS}
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={s.isCaptain}
              onChange={(e) => void send(`/api/roster/spots/${s.id}`, "PATCH", { isCaptain: e.target.checked })}
            />
            Капитан
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send(`/api/roster/spots/${s.id}`, "DELETE")}
            className="rounded border border-neutral-800 px-3 py-2 text-sm text-neutral-400 hover:border-rose-600 hover:text-rose-400 disabled:opacity-50"
          >
            Убрать
          </button>
        </div>
      ))}

      {free.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded border border-dashed border-neutral-800 p-3">
          <div className="w-56">
            <SelectField
              label="Добавить в состав"
              value={newTeam}
              onChange={setNewTeam}
              options={[{ value: "", label: "— выберите команду —" }, ...free.map((t) => ({ value: String(t.id), label: t.name }))]}
            />
          </div>
          <div className="w-56">
            <SelectField label="Роль" value={newRole} onChange={setNewRole} options={ROLE_OPTIONS} />
          </div>
          <button
            type="button"
            disabled={busy || !newTeam}
            onClick={() => void send("/api/roster/spots", "POST", { playerId, teamId: Number(newTeam), role: newRole })}
            className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Добавить
          </button>
        </div>
      )}

      {error && <p className="text-sm text-rose-400">{error}</p>}
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
