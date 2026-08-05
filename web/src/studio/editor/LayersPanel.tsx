"use client";

import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, EyeIcon, EyeOffIcon, TrashIcon } from "lucide-react";
import { Label } from "@/app/_components/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Element } from "./model";

// Панель слоёв: список элементов сверху-вниз по z-order (верхний слой — первым). Клик выделяет,
// глаз скрывает/показывает, корзина удаляет, стрелки двигают по слоям. Иерархия = порядок в списке.

export function LayersPanel({
  elements,
  selectedId,
  onSelect,
  onToggleHidden,
  onRemove,
  onOrder,
  onRename,
}: {
  elements: Element[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleHidden: (id: string, hidden: boolean) => void;
  onRemove: (id: string) => void;
  onOrder: (id: string, dir: "up" | "down") => void;
  onRename: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // в документе последний элемент рисуется поверх → в списке показываем в обратном порядке
  const rows = [...elements].reverse();

  function commit(id: string) {
    onRename(id, draft.trim());
    setEditing(null);
  }

  return (
    <div>
      <Label>Слои</Label>
      {rows.length === 0 ? (
        <p className="mt-1 text-xs text-ink-subtle">Пока пусто.</p>
      ) : (
        <ul className="scroll-dark mt-1 max-h-64 space-y-1 overflow-y-auto pr-1">
          {rows.map((el) => (
            <li
              key={el.id}
              onClick={() => onSelect(el.id)}
              className={`group flex items-center gap-1.5 rounded px-2 py-1 text-sm ${
                el.id === selectedId ? "bg-accent/15 text-accent-bright" : "text-ink-muted hover:bg-surface-2"
              } ${el.hidden ? "opacity-50" : ""}`}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                title={el.hidden ? "Показать" : "Скрыть"}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHidden(el.id, !el.hidden);
                }}
                className="shrink-0 text-ink-subtle hover:text-ink"
              >
                {el.hidden ? <EyeOffIcon /> : <EyeIcon />}
              </Button>
              {editing === el.id ? (
                <Input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => commit(el.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit(el.id);
                    else if (e.key === "Escape") setEditing(null);
                  }}
                  className="h-6 min-w-0 flex-1 px-1 py-0 text-sm"
                />
              ) : (
                <span
                  className="min-w-0 flex-1 truncate"
                  title="Двойной клик — переименовать"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setDraft(el.name ?? "");
                    setEditing(el.id);
                  }}
                >
                  {layerName(el)}
                </span>
              )}
              {/* Действия по слою — по наведению или у выделенного; иначе имя занимает всю строку */}
              <div
                className={`shrink-0 items-center gap-0.5 ${
                  el.id === selectedId ? "flex" : "hidden group-hover:flex"
                }`}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  title="Выше"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOrder(el.id, "up");
                  }}
                  className="text-ink-subtle hover:text-ink"
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  title="Ниже"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOrder(el.id, "down");
                  }}
                  className="text-ink-subtle hover:text-ink"
                >
                  <ArrowDownIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  title="Удалить"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(el.id);
                  }}
                  className="text-ink-subtle hover:text-rose-400"
                >
                  <TrashIcon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function layerName(el: Element): string {
  if (el.name?.trim()) return el.name;
  if (el.type === "text") return el.text.trim() ? `Текст: ${el.text}` : "Текст";
  if (el.type === "image") return "Картинка";
  return el.type === "rect" ? "Прямоугольник" : "Эллипс";
}
