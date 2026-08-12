"use client";

import { useActionState, useMemo, useState } from "react";
import { createProfile, claim } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Онбординг после первого входа: аккаунт есть, профиля ещё нет. Развилка ровно по ТЗ —
// «новый игрок» заводит профиль сразу, «уже в ростере» подаёт заявку на подтверждение.

type LinkablePlayer = { id: number; nickname: string; slug: string };

const errorBox = "rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300";

export function Onboarding({ players }: { players: LinkablePlayer[] }) {
  const [mode, setMode] = useState<"pick" | "new" | "existing">("pick");

  if (mode === "pick") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">Вы впервые здесь. Кто вы?</p>
        <div className="grid gap-2">
          <button
            onClick={() => setMode("existing")}
            className="rounded-lg border border-hairline bg-surface-1 px-4 py-3 text-left transition-colors hover:border-accent"
          >
            <span className="block font-medium">Я уже в ростере</span>
            <span className="mt-0.5 block text-xs text-ink-subtle">Найти себя и привязать профиль (подтвердит оператор).</span>
          </button>
          <button
            onClick={() => setMode("new")}
            className="rounded-lg border border-hairline bg-surface-1 px-4 py-3 text-left transition-colors hover:border-accent"
          >
            <span className="block font-medium">Я новый игрок</span>
            <span className="mt-0.5 block text-xs text-ink-subtle">Завести личный профиль в лиге.</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button onClick={() => setMode("pick")} className="text-xs text-ink-subtle hover:text-ink">
        ← назад
      </button>
      {mode === "new" ? <NewProfileForm /> : <ClaimForm players={players} />}
    </div>
  );
}

function NewProfileForm() {
  const [error, action, pending] = useActionState(createProfile, null);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm text-ink-muted">Ник в лиге</label>
        <Input name="nickname" autoFocus placeholder="Например, Miracle-" />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Создаю…" : "Создать профиль"}
      </Button>
      {error && <p className={errorBox}>{error}</p>}
    </form>
  );
}

function ClaimForm({ players }: { players: LinkablePlayer[] }) {
  const [error, action, pending] = useActionState(claim, null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<LinkablePlayer | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return players.filter((p) => p.nickname.toLowerCase().includes(q)).slice(0, 8);
  }, [players, query]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="playerId" value={picked?.id ?? ""} />
      <div>
        <label className="mb-1 block text-sm text-ink-muted">Ваш ник в ростере</label>
        <Input
          autoFocus
          placeholder="Начните вводить ник"
          value={picked ? picked.nickname : query}
          onChange={(e) => {
            setPicked(null);
            setQuery(e.target.value);
          }}
        />
        {!picked && matches.length > 0 && (
          <ul className="mt-1 overflow-hidden rounded-md border border-hairline bg-surface-1">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(p);
                    setQuery("");
                  }}
                  className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2"
                >
                  {p.nickname}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!picked && query.trim() && matches.length === 0 && (
          <p className="mt-1 text-xs text-ink-subtle">Никого не нашли. Возможно, вас ещё нет в ростере — тогда заведите новый профиль.</p>
        )}
      </div>
      <Button type="submit" disabled={pending || !picked} className="w-full">
        {pending ? "Отправляю…" : "Подать заявку на привязку"}
      </Button>
      {error && <p className={errorBox}>{error}</p>}
    </form>
  );
}
