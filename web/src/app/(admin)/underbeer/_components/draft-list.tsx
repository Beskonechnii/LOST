"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Список драфтов с удалением. Клиент, потому что удаление — это DELETE (запись); карточки
// убираем оптимистично из локального состояния, чтобы не перезапрашивать всю страницу.
//
// Подтверждение — Radix AlertDialog, а не window.confirm(): нативный диалог подавляется
// в webview (например, в панели предпросмотра), и кнопка «молча не работала». Плюс фокус-ловушка,
// Esc и имя драфта в заголовке — единый язык с модалкой архива серий.

type Item = { id: number; title: string | null; status: string; updated: string };

export function DraftList({ sessions }: { sessions: Item[] }) {
  const [items, setItems] = useState(sessions);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const pending = items.find((s) => s.id === confirmId);

  async function remove(id: number) {
    setBusy(id);
    try {
      const res = await fetch(`/api/underbeer/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setItems((x) => x.filter((s) => s.id !== id));
    } catch (e) {
      toast.error(`Не удалось удалить: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
      setConfirmId(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-hairline p-8 text-center text-sm text-ink-subtle">
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
              className="block rounded-xl border border-hairline bg-surface-1 p-4 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_12px_36px_-26px_rgba(0,0,0,0.9)] transition duration-200 hover:-translate-y-0.5 hover:border-amber-500/60"
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
              <div className="mt-2 text-xs text-ink-subtle">Обновлён {s.updated}</div>
            </Link>

            {/* Удаление — кнопка поверх карточки, отдельно от ссылки (кнопку в ссылку вкладывать нельзя).
                Само подтверждение — один AlertDialog на список, ниже; сюда кладём только его триггер. */}
            <button
              onClick={() => setConfirmId(s.id)}
              title="Удалить драфт"
              className="absolute right-2 top-2 rounded p-1 text-ink-subtle opacity-0 transition-opacity hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100"
            >
              ✕
            </button>
          </li>
        );
      })}

      <AlertDialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить драфт?</AlertDialogTitle>
            <AlertDialogDescription>
              «{pending?.title ?? `Драфт #${pending?.id}`}» будет удалён без возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              // preventDefault: не закрываем сразу — remove() снимет confirmId сам в finally, показав «…».
              onClick={(e) => {
                e.preventDefault();
                if (confirmId !== null) remove(confirmId);
              }}
              disabled={busy !== null}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              {busy !== null ? "…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ul>
  );
}
