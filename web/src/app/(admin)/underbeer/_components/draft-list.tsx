"use client";

import Link from "next/link";
import { useState } from "react";

// Список драфтов с удалением. Клиент, потому что удаление — это DELETE (запись); карточки
// убираем оптимистично из локального состояния, чтобы не перезапрашивать всю страницу.
//
// Подтверждение — встроенное (два клика), а не window.confirm(): нативный диалог подавляется
// в webview (например, в панели предпросмотра), и кнопка «молча не работала».

type Item = { id: number; title: string | null; status: string; updated: string };

export function DraftList({ sessions }: { sessions: Item[] }) {
  const [items, setItems] = useState(sessions);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  async function remove(id: number) {
    setBusy(id);
    try {
      const res = await fetch(`/api/underbeer/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setItems((x) => x.filter((s) => s.id !== id));
    } catch (e) {
      alert(`Не удалось удалить: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
      setConfirmId(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded border border-dashed border-neutral-800 p-8 text-center text-sm text-neutral-600">
        Пока нет ни одного драфта. Нажми «Новый драфт», чтобы собрать команды.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => {
        const label = s.title ?? `Драфт #${s.id}`;
        return (
          <li key={s.id} className="group relative">
            <Link
              href={`/underbeer/${s.id}`}
              className="block rounded border border-neutral-800 bg-neutral-900/40 p-4 transition-colors hover:border-amber-600"
            >
              <div className="flex items-center justify-between gap-2 pr-16">
                <span className="truncate font-semibold">{label}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                    s.status === "done" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {s.status === "done" ? "Собран" : "Черновик"}
                </span>
              </div>
              <div className="mt-2 text-xs text-neutral-600">Обновлён {s.updated}</div>
            </Link>

            {/* Удаление — кнопки поверх карточки, отдельно от ссылки (кнопку в ссылку вкладывать нельзя) */}
            {confirmId === s.id ? (
              <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                <button
                  onClick={() => remove(s.id)}
                  disabled={busy === s.id}
                  className="rounded bg-red-600/90 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {busy === s.id ? "…" : "Удалить"}
                </button>
                <button
                  onClick={() => setConfirmId(null)}
                  className="rounded px-1.5 py-0.5 text-[11px] text-neutral-400 hover:text-neutral-200"
                >
                  Отмена
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmId(s.id)}
                title="Удалить драфт"
                className="absolute right-2 top-2 rounded p-1 text-neutral-600 opacity-0 transition-opacity hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100"
              >
                ✕
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
