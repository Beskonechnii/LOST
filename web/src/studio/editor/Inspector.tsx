"use client";

import { TrashIcon } from "lucide-react";
import { Label, SelectField, TextField } from "@/app/_components/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorField, NumberField } from "./controls";
import type { FontDef } from "./fonts";
import type { Element } from "./model";

// Правая панель: свойства выделенного элемента. Патчит одно поле — workspace сливает в документ.
// Общие поля (позиция/размер/поворот/прозрачность) сверху, типовые — ниже.

export function Inspector({
  el,
  fonts,
  onChange,
  onRemove,
  onOrder,
}: {
  el: Element | null;
  fonts: FontDef[];
  onChange: (patch: Partial<Element>) => void;
  onRemove: () => void;
  onOrder: (dir: "front" | "back" | "up" | "down") => void;
}) {
  if (!el) {
    return <p className="text-sm text-ink-subtle">Выделите элемент на холсте, чтобы править его свойства.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-ink-subtle">{typeLabel(el)}</span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onRemove}
          className="text-ink-subtle hover:text-rose-400"
        >
          <TrashIcon />
          Удалить
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="X" value={el.x} onChange={(v) => onChange({ x: v })} />
        <NumberField label="Y" value={el.y} onChange={(v) => onChange({ y: v })} />
        <NumberField label="Ширина" value={el.w} min={1} onChange={(v) => onChange({ w: v })} />
        <NumberField label="Высота" value={el.h} min={1} onChange={(v) => onChange({ h: v })} />
        <NumberField label="Поворот°" value={el.rotation} onChange={(v) => onChange({ rotation: v })} />
        <NumberField
          label="Прозрачность %"
          value={Math.round(el.opacity * 100)}
          min={0}
          onChange={(v) => onChange({ opacity: Math.min(1, Math.max(0, v / 100)) })}
        />
      </div>

      {el.type === "text" && (
        <div className="space-y-3 border-t border-hairline pt-3">
          <TextField label="Текст" value={el.text} onChange={(v) => onChange({ text: v })} />
          <SelectField
            label="Шрифт"
            value={el.font}
            onChange={(v) => onChange({ font: v })}
            options={fonts.map((f) => ({ value: f.family, label: f.label }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Кегль" value={el.size} min={1} onChange={(v) => onChange({ size: v })} />
            <SelectField
              label="Жирность"
              value={String(el.weight)}
              onChange={(v) => onChange({ weight: Number(v) })}
              options={[
                { value: "400", label: "400 — обычный" },
                { value: "600", label: "600 — полужирный" },
                { value: "700", label: "700 — жирный" },
                { value: "800", label: "800 — чёрный" },
                { value: "900", label: "900 — сверхжирный" },
              ]}
            />
            <NumberField label="Межбуквенный" value={el.letterSpacing} onChange={(v) => onChange({ letterSpacing: v })} />
            <NumberField
              label="Межстрочный"
              value={el.lineHeight}
              step={0.1}
              onChange={(v) => onChange({ lineHeight: v })}
            />
          </div>
          <ColorField label="Цвет" value={el.color} onChange={(v) => onChange({ color: v })} />
          <SelectField
            label="Выравнивание"
            value={el.align}
            onChange={(v) => onChange({ align: v as "left" | "center" | "right" })}
            options={[
              { value: "left", label: "по левому" },
              { value: "center", label: "по центру" },
              { value: "right", label: "по правому" },
            ]}
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
            <Checkbox checked={el.uppercase} onCheckedChange={(v) => onChange({ uppercase: v === true })} />
            ПРОПИСНЫЕ
          </label>
        </div>
      )}

      {el.type === "image" && (
        <div className="space-y-3 border-t border-hairline pt-3">
          <SelectField
            label="Вписывание"
            value={el.fit}
            onChange={(v) => onChange({ fit: v as "cover" | "contain" })}
            options={[
              { value: "contain", label: "целиком (contain)" },
              { value: "cover", label: "заполнить (cover)" },
            ]}
          />
          <NumberField label="Скругление" value={el.radius} min={0} onChange={(v) => onChange({ radius: v })} />
        </div>
      )}

      {(el.type === "rect" || el.type === "ellipse") && (
        <div className="space-y-3 border-t border-hairline pt-3">
          <ColorField label="Заливка" value={el.fill} onChange={(v) => onChange({ fill: v })} />
          {el.type === "rect" && (
            <NumberField label="Скругление" value={el.radius} min={0} onChange={(v) => onChange({ radius: v })} />
          )}
          <ColorField label="Обводка" value={el.stroke ?? "#000000"} onChange={(v) => onChange({ stroke: v })} />
          <NumberField
            label="Толщина обводки"
            value={el.strokeWidth}
            min={0}
            onChange={(v) => onChange({ strokeWidth: v })}
          />
        </div>
      )}

      <div className="border-t border-hairline pt-3">
        <Label>Порядок слоёв</Label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOrder("front")}>
            На передний план
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onOrder("back")}>
            На задний план
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onOrder("up")}>
            Выше
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onOrder("down")}>
            Ниже
          </Button>
        </div>
      </div>
    </div>
  );
}

function typeLabel(el: Element): string {
  return el.type === "text" ? "Текст" : el.type === "image" ? "Картинка" : el.type === "rect" ? "Прямоугольник" : "Эллипс";
}
