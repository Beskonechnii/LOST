"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ElementView } from "./ElementView";
import type { DesignDoc, Element } from "./model";

// Интерактивный холст редактора. Устроен как студийный Canvas.tsx: содержимое рисуется в натуральных
// пикселях, на экран влезает через transform: scale (contain, ResizeObserver). Ключевое отличие —
// слой взаимодействия (выделение, ручки resize/rotate, drag) лежит РЯДОМ с натуральным узлом, не внутри.
// Поэтому domToPng снимает чистый узел (nodeRef) без ручек: «что вижу — то и скачал».
//
// Пойнтер-математика ведётся в натуральных координатах: экранные дельты делятся на scale.

const HANDLES = [
  { pos: "nw", hx: -1, hy: -1 },
  { pos: "n", hx: 0, hy: -1 },
  { pos: "ne", hx: 1, hy: -1 },
  { pos: "e", hx: 1, hy: 0 },
  { pos: "se", hx: 1, hy: 1 },
  { pos: "s", hx: 0, hy: 1 },
  { pos: "sw", hx: -1, hy: 1 },
  { pos: "w", hx: -1, hy: 0 },
] as const;

const MIN_SIZE = 8; // минимальный размер элемента в натуральных пикселях
const SNAP = 8; // порог примагничивания в натуральных пикселях (к краям и центру холста)

type Drag =
  | { kind: "move"; id: string; startX: number; startY: number; ex: number; ey: number }
  | { kind: "resize"; id: string; hx: number; hy: number; startX: number; startY: number; el: Element }
  | { kind: "rotate"; id: string; cx: number; cy: number };

export function EditorCanvas({
  doc,
  nodeRef,
  selectedId,
  onSelect,
  onChange,
  showGrid = false,
  gridSize = 40,
  constrain = true,
}: {
  doc: DesignDoc;
  nodeRef: React.RefObject<HTMLDivElement | null>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<Element>) => void;
  showGrid?: boolean;
  gridSize?: number;
  constrain?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const drag = useRef<Drag | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = (width: number, height: number) => setScale(Math.min(width / doc.w, height / doc.h));
    fit(el.clientWidth, el.clientHeight);
    const ro = new ResizeObserver(([entry]) => fit(entry.contentRect.width, entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc.w, doc.h]);

  const selected = doc.elements.find((e) => e.id === selectedId) ?? null;

  /** Экранная точка → натуральные координаты холста (относительно левого-верхнего угла макета). */
  function toNatural(clientX: number, clientY: number) {
    const rect = frame.current?.getBoundingClientRect();
    if (!rect || scale === 0) return { x: 0, y: 0 };
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  }

  function onPointerDownBody(e: ReactPointerEvent, el: Element) {
    e.stopPropagation();
    onSelect(el.id);
    const p = toNatural(e.clientX, e.clientY);
    drag.current = { kind: "move", id: el.id, startX: p.x, startY: p.y, ex: el.x, ey: el.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerDownHandle(e: ReactPointerEvent, el: Element, hx: number, hy: number) {
    e.stopPropagation();
    const p = toNatural(e.clientX, e.clientY);
    drag.current = { kind: "resize", id: el.id, hx, hy, startX: p.x, startY: p.y, el };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerDownRotate(e: ReactPointerEvent, el: Element) {
    e.stopPropagation();
    drag.current = { kind: "rotate", id: el.id, cx: el.x + el.w / 2, cy: el.y + el.h / 2 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = toNatural(e.clientX, e.clientY);

    if (d.kind === "move") {
      let nx = d.ex + (p.x - d.startX);
      let ny = d.ey + (p.y - d.startY);
      const el = doc.elements.find((x) => x.id === d.id);
      if (el) {
        nx += snapAxis(nx, el.w, doc.w, showGrid ? gridSize : 0);
        ny += snapAxis(ny, el.h, doc.h, showGrid ? gridSize : 0);
        // холст ограничивает элемент, только если включён режим «в пределах холста»
        if (constrain) {
          nx = clamp(nx, doc.w, el.w);
          ny = clamp(ny, doc.h, el.h);
        }
      }
      onChange(d.id, { x: Math.round(nx), y: Math.round(ny) });
      return;
    }

    if (d.kind === "resize") {
      const { el, hx, hy } = d;
      const θ = (el.rotation * Math.PI) / 180;
      const cos = Math.cos(θ);
      const sin = Math.sin(θ);
      const dxn = p.x - d.startX;
      const dyn = p.y - d.startY;
      // дельта в локальных осях элемента (поворот на -θ)
      const ldx = dxn * cos + dyn * sin;
      const ldy = -dxn * sin + dyn * cos;
      const newW = Math.max(MIN_SIZE, el.w + hx * ldx);
      const newH = Math.max(MIN_SIZE, el.h + hy * ldy);
      // противоположный край фиксируем: центр смещается на половину прироста в локальных осях
      const lcx = (hx * (newW - el.w)) / 2;
      const lcy = (hy * (newH - el.h)) / 2;
      const wcx = lcx * cos - lcy * sin; // локальное смещение центра → мировое (поворот на +θ)
      const wcy = lcx * sin + lcy * cos;
      const cx = el.x + el.w / 2 + wcx;
      const cy = el.y + el.h / 2 + wcy;
      onChange(d.id, {
        w: Math.round(newW),
        h: Math.round(newH),
        x: Math.round(cx - newW / 2),
        y: Math.round(cy - newH / 2),
      });
      return;
    }

    if (d.kind === "rotate") {
      const deg = (Math.atan2(p.y - d.cy, p.x - d.cx) * 180) / Math.PI + 90;
      const snapped = e.shiftKey ? Math.round(deg / 15) * 15 : Math.round(deg);
      onChange(d.id, { rotation: snapped });
    }
  }

  function endDrag(e: ReactPointerEvent) {
    if (drag.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // pointer capture мог не проставиться — не критично
      }
    }
    drag.current = null;
  }

  return (
    <div
      ref={box}
      className="flex h-full w-full items-center justify-center overflow-hidden"
      onPointerDown={() => onSelect(null)}
    >
      <div
        ref={frame}
        style={{ width: doc.w * scale, height: doc.h * scale }}
        className="relative overflow-hidden rounded border border-neutral-800 shadow-lg shadow-black/40"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
      >
        {/* чистый натуральный узел — его и снимает экспорт */}
        <div
          ref={nodeRef}
          style={{
            width: doc.w,
            height: doc.h,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            background: doc.background,
            position: "absolute",
            left: 0,
            top: 0,
          }}
        >
          {doc.elements.filter((el) => !el.hidden).map((el) => (
            <ElementView key={el.id} el={el} />
          ))}
        </div>

        {/* сетка-помощник поверх макета, но вне снимаемого узла — в PNG не попадает */}
        {showGrid && gridSize > 0 && scale > 0 && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(168,85,247,.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(168,85,247,.25) 1px, transparent 1px)",
              backgroundSize: `${gridSize * scale}px ${gridSize * scale}px`,
            }}
          />
        )}

        {/* слой взаимодействия: боксы для выбора/перетаскивания + ручки выделенного. В снимок не входит.
            Клик мимо элементов пробрасывается на внешний бокс → снимает выделение. */}
        <div className="absolute inset-0">
          {doc.elements.filter((el) => !el.hidden).map((el) => (
            <div
              key={el.id}
              onPointerDown={(e) => onPointerDownBody(e, el)}
              style={{
                position: "absolute",
                left: el.x * scale,
                top: el.y * scale,
                width: el.w * scale,
                height: el.h * scale,
                transform: `rotate(${el.rotation}deg)`,
                transformOrigin: "center center",
                cursor: "move",
                outline: el.id === selectedId ? "2px solid #a855f7" : "none",
                outlineOffset: 0,
              }}
            />
          ))}

          {selected && scale > 0 && (
            <div
              style={{
                position: "absolute",
                left: selected.x * scale,
                top: selected.y * scale,
                width: selected.w * scale,
                height: selected.h * scale,
                transform: `rotate(${selected.rotation}deg)`,
                transformOrigin: "center center",
                pointerEvents: "none",
              }}
            >
              {/* ручка поворота — над верхней гранью */}
              <div
                onPointerDown={(e) => onPointerDownRotate(e, selected)}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: -28,
                  width: 12,
                  height: 12,
                  marginLeft: -6,
                  borderRadius: "50%",
                  background: "#22d3ee",
                  border: "2px solid #0b0413",
                  cursor: "grab",
                  pointerEvents: "auto",
                }}
              />
              {HANDLES.map((h) => (
                <div
                  key={h.pos}
                  onPointerDown={(e) => onPointerDownHandle(e, selected, h.hx, h.hy)}
                  style={{
                    position: "absolute",
                    left: `calc(${(h.hx + 1) * 50}% - 6px)`,
                    top: `calc(${(h.hy + 1) * 50}% - 6px)`,
                    width: 12,
                    height: 12,
                    background: "#a855f7",
                    border: "2px solid #0b0413",
                    cursor: cursorFor(h.pos),
                    pointerEvents: "auto",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Примагничивание по одной оси: левый край → 0, правый → размеру холста, центр элемента → центру
 * холста, а при включённой сетке — ближайшая линия сетки для края и центра. Возвращает дельту.
 */
function snapAxis(pos: number, size: number, canvas: number, grid: number): number {
  const feats: { val: number; targets: number[] }[] = [
    { val: pos, targets: [0] }, // левый/верхний край
    { val: pos + size / 2, targets: [canvas / 2] }, // центр элемента
    { val: pos + size, targets: [canvas] }, // правый/нижний край
  ];
  let best: number | null = null;
  for (const f of feats) {
    const targets = [...f.targets];
    if (grid > 0) targets.push(Math.round(f.val / grid) * grid); // ближайшая линия сетки
    for (const t of targets) {
      const d = t - f.val;
      if (Math.abs(d) <= SNAP && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
  }
  return best ?? 0;
}

/** Держим элемент в пределах холста: сдвигаем позицию в [0, canvas - size]. */
function clamp(pos: number, canvas: number, size: number): number {
  const max = canvas - size;
  if (max < 0) return Math.min(0, Math.max(max, pos)); // элемент крупнее холста — не зажимаем жёстко
  return Math.max(0, Math.min(max, pos));
}

function cursorFor(pos: string): string {
  if (pos === "n" || pos === "s") return "ns-resize";
  if (pos === "e" || pos === "w") return "ew-resize";
  if (pos === "nw" || pos === "se") return "nwse-resize";
  return "nesw-resize";
}
