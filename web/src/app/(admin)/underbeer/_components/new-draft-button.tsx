"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Создать пустую сессию драфта и уйти в неё. Отдельная кнопка-клиент: создание — это POST (запись),
// а страница-список серверная.

export function NewDraftButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/underbeer", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!res.ok) throw new Error(await res.text());
      const session = (await res.json()) as { id: number };
      router.push(`/underbeer/${session.id}`);
    } catch (e) {
      alert(`Не удалось создать драфт: ${e instanceof Error ? e.message : e}`);
      setBusy(false);
    }
  }

  return (
    <button
      onClick={create}
      disabled={busy}
      className="shrink-0 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-amber-500 disabled:opacity-50"
    >
      {busy ? "Создаю…" : "Новый драфт"}
    </button>
  );
}
