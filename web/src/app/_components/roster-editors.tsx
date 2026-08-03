"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageField, SaveButton, SelectField, TextField, Label } from "./form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
              className="h-10 w-12 rounded-lg border border-hairline bg-surface-1"
            />
            <Input value={v.color} placeholder="#A855F7" onChange={(e) => set("color", e.target.value)} />
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
  birthday: string;
  city: string;
  country: string;
  photo: string | null;
};

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-hairline bg-surface-1 p-4 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_12px_36px_-26px_rgba(0,0,0,0.9)]">
      <h3 className="mb-3 text-xs uppercase tracking-widest text-ink-subtle">{title}</h3>
      {children}
    </section>
  );
}

export function PlayerEditor({ id, initial }: { id: number; initial: PlayerForm }) {
  const [v, setV] = useState(initial);
  const set = <K extends keyof PlayerForm>(k: K, val: PlayerForm[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <div className="space-y-4">
      {/* Личное и игровое разведены: анкету из CRM заполняют одни люди, account_id и MMR — другие */}
      <Fieldset title="Человек">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label="Ник" value={v.nickname} onChange={(x) => set("nickname", x)} />
          <TextField label="Имя" value={v.realName} onChange={(x) => set("realName", x)} />
          <TextField label="Дата рождения" type="date" value={v.birthday} onChange={(x) => set("birthday", x)} />
          <TextField label="Город" value={v.city} onChange={(x) => set("city", x)} placeholder="Минск" />
          <TextField label="Страна" value={v.country} onChange={(x) => set("country", x)} placeholder="Беларусь" />
          <TextField
            label="Telegram"
            value={v.telegram}
            onChange={(x) => set("telegram", x)}
            placeholder="@nick"
            hint="Можно вставить ссылку t.me — сохраним хендл"
          />
        </div>
      </Fieldset>

      <Fieldset title="Игра">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="Dota account_id"
            value={v.accountId}
            onChange={(x) => set("accountId", x)}
            placeholder="123456789"
            hint="Или ссылка на steamcommunity.com/profiles/… — id вытащим сами"
          />
          <TextField label="MMR" value={v.mmr} onChange={(x) => set("mmr", x)} placeholder="7000" />
        </div>
      </Fieldset>

      <Fieldset title="Фото">
        <ImageField label="Портрет" kind="players" value={v.photo} onChange={(x) => set("photo", x)} hint="Для плашек и анонсов" />
      </Fieldset>

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
      {spots.length === 0 && <p className="text-sm text-ink-subtle">Игрок не числится ни в одном составе.</p>}

      {spots.map((s) => (
        <div key={s.id} className="flex flex-wrap items-end gap-3 rounded-xl border border-hairline bg-surface-1 p-3">
          <div className="min-w-40 flex-1 text-sm font-medium text-ink">{s.teamName}</div>
          <div className="w-56">
            <SelectField
              label="Роль"
              value={s.role}
              onChange={(x) => void send(`/api/roster/spots/${s.id}`, "PATCH", { role: x })}
              options={ROLE_OPTIONS}
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-ink-muted">
            <Checkbox
              checked={s.isCaptain}
              onCheckedChange={(v) => void send(`/api/roster/spots/${s.id}`, "PATCH", { isCaptain: v === true })}
            />
            Капитан
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void send(`/api/roster/spots/${s.id}`, "DELETE")}
            className="hover:border-rose-600/60 hover:bg-transparent hover:text-rose-400"
          >
            Убрать
          </Button>
        </div>
      ))}

      {free.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-hairline p-3">
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
          <Button
            type="button"
            disabled={busy || !newTeam}
            onClick={() => void send("/api/roster/spots", "POST", { playerId, teamId: Number(newTeam), role: newRole })}
          >
            Добавить
          </Button>
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
    <div className="rounded-xl border border-hairline bg-surface-1 p-4 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_12px_36px_-26px_rgba(0,0,0,0.9)]">
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
        <Button type="button" disabled={busy} onClick={() => void submit()}>
          {busy ? "…" : submitLabel}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
    </div>
  );
}
