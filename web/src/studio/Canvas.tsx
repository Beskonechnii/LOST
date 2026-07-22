"use client";

import { useEffect, useRef, useState } from "react";

// Холст шаблона: содержимое всегда в натуральных пикселях (1920×1080 и т.п.),
// на экран влезает через transform: scale. Экспорт снимает тот же узел без масштаба,
// поэтому «что вижу» и «что скачал» совпадают.

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
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / w));
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);

  return (
    <div ref={box} style={{ width: "100%", height: h * scale }} className="overflow-hidden rounded border border-neutral-800">
      <div ref={nodeRef} style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}
