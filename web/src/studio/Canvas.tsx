"use client";

import { useLayoutEffect, useRef, useState } from "react";

// Холст шаблона: содержимое всегда в натуральных пикселях (1920×1080 и т.п.),
// на экран влезает через transform: scale. Экспорт снимает тот же узел без масштаба,
// поэтому «что вижу» и «что скачал» совпадают.
// Масштаб — contain по обеим сторонам доступной области, макет центрируется.

export function Canvas({
  w,
  h,
  nodeRef,
  children,
}: {
  w: number;
  h: number;
  nodeRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = (width: number, height: number) => setScale(Math.min(width / w, height / h));
    // первый замер синхронно — иначе первый кадр рисуется с нулевым масштабом
    fit(el.clientWidth, el.clientHeight);
    const ro = new ResizeObserver(([entry]) => fit(entry.contentRect.width, entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h]);

  return (
    <div ref={box} className="flex h-full w-full items-center justify-center overflow-hidden">
      {/* внешняя рамка занимает ровно размер отмасштабированного макета */}
      <div
        style={{ width: w * scale, height: h * scale }}
        className="overflow-hidden rounded border border-neutral-800 bg-neutral-950 shadow-lg shadow-black/40"
      >
        <div
          ref={nodeRef}
          style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
