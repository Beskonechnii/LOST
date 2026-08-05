"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Полка «Графика серий» с режимом выбора: «Выбрать» включает чекбоксы, дальше «Выбрать все» и
// удаление пачкой. Обычные карточки без корзины — чтобы не держать лишний хром на каждой.

type Row = { id: number; title: string | null; kind: string | null; updated: string };

const KIND_LABEL: Record<string, string> = { announce: "Анонс", announce2: "Анонс 2", score: "Счёт", result: "Итог" };

export function GraphicsShelf({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const exit = () => {
    setSelecting(false);
    setSelected(new Set());
    setConfirming(false);
  };
  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // удаление — вторым кликом (подтверждение), затем пачка DELETE и обновление списка
  async function removeSelected() {
    if (!confirming) return setConfirming(true);
    setBusy(true);
    await Promise.all([...selected].map((id) => fetch(`/api/studio/designs/${id}`, { method: "DELETE" })));
    setBusy(false);
    exit();
    router.refresh();
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-subtle">Графика серий</span>
        <span className="text-xs text-ink-subtle">{rows.length}</span>
        <div className="ml-auto flex items-center gap-2">
          {!selecting ? (
            rows.length > 0 && (
              <Button type="button" variant="outline" size="xs" onClick={() => setSelecting(true)}>
                Выбрать
              </Button>
            )
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
              >
                {allSelected ? "Снять все" : "Выбрать все"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={busy || selected.size === 0}
                onClick={() => void removeSelected()}
                className={confirming ? "border-rose-500 text-rose-400" : "text-rose-400"}
              >
                {busy ? "…" : confirming ? `Точно удалить ${selected.size}?` : `Удалить (${selected.size})`}
              </Button>
              <Button type="button" variant="ghost" size="xs" onClick={exit}>
                Готово
              </Button>
            </>
          )}
        </div>
      </div>
      <p className="mb-3 text-xs text-ink-subtle">
        Собранные из мастеров карточки встреч. «Выбрать» — чтобы удалить пачкой; мастер не пострадает.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-subtle">Пока пусто — соберите графику кнопками в архиве серий.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((d) => {
            const isSel = selected.has(d.id);
            const card = (
              <div
                className={`block rounded-xl border p-4 pr-12 transition ${
                  isSel ? "border-accent bg-accent/10" : "border-hairline bg-surface-1"
                } ${selecting ? "cursor-pointer hover:border-accent/60" : "hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface-2"}`}
              >
                <div className="flex items-center gap-2">
                  {d.kind && (
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-ink-muted">
                      {KIND_LABEL[d.kind] ?? d.kind}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{d.title || `Документ #${d.id}`}</span>
                </div>
                <div className="mt-1 text-xs text-ink-subtle">изменён {d.updated}</div>
              </div>
            );
            return (
              <div key={d.id} className="relative">
                {selecting ? (
                  <div onClick={() => toggle(d.id)}>{card}</div>
                ) : (
                  <Link href={`/studio/editor/${d.id}`}>{card}</Link>
                )}
                {selecting && (
                  <span
                    className={`pointer-events-none absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md border ${
                      isSel ? "border-accent bg-accent text-white" : "border-hairline bg-canvas/70 text-transparent"
                    }`}
                  >
                    <CheckIcon className="h-4 w-4" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
