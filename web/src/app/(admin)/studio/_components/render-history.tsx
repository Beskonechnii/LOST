"use client";

import Link from "next/link";
import { useState } from "react";

// История генераций с удалением. Клиент — удаление это DELETE (запись); строки убираем
// оптимистично, чтобы не перезапрашивать страницу. Подтверждение встроенное (два клика),
// а не window.confirm(): нативный диалог подавляется в webview и кнопка «молча не работала».

type Item = { id: number; templateId: string; title: string | null; created: string };

export function RenderHistory({ renders }: { renders: Item[] }) {
  const [items, setItems] = useState(renders);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  async function remove(id: number) {
    setBusy(id);
    try {
      const res = await fetch(`/api/studio/renders/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setItems((x) => x.filter((r) => r.id !== id));
    } catch (e) {
      alert(`Не удалось удалить: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
      setConfirmId(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm uppercase tracking-widest text-ink-subtle">История</h2>
      <ul className="space-y-2 text-sm">
        {items.map((r) => {
          const label = r.title ?? r.templateId;
          return (
            <li key={r.id} className="flex items-center gap-2">
              <Link href={`/studio/new/${r.templateId}?render=${r.id}`} className="text-accent-bright hover:underline">
                {label}
              </Link>
              <span className="text-xs text-ink-subtle">{r.created}</span>
              {confirmId === r.id ? (
                <span className="ml-1 flex items-center gap-1">
                  <button
                    onClick={() => remove(r.id)}
                    disabled={busy === r.id}
                    className="rounded bg-red-600/90 px-1.5 py-0.5 text-[11px] font-medium text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    {busy === r.id ? "…" : "Удалить"}
                  </button>
                  <button onClick={() => setConfirmId(null)} className="text-[11px] text-ink-subtle hover:text-ink-muted">
                    Отмена
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmId(r.id)}
                  title="Удалить из истории"
                  className="ml-1 rounded p-0.5 text-xs text-ink-subtle transition-colors hover:text-red-400"
                >
                  ✕
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
