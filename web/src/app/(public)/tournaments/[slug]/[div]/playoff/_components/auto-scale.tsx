"use client";

import { useEffect, useRef, useState } from "react";

// Сетка нарисована в натуральных пикселях (абсолютное позиционирование), поэтому под ширину
// контейнера её масштабируем `transform: scale` — как Canvas студии: «что нарисовано, то и тянется».
// Заполняем всю доступную ширину: на узком экране ужимаем, на широком — увеличиваем (потолок 2,
// чтобы на ультравайде не раздувать до нечитаемого). Высоту оболочки задаём под масштаб, иначе
// снизу останется пустое место или, наоборот, контент налезет на соседний блок.
const MAX_SCALE = 2;

export function AutoScale({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(Math.min(MAX_SCALE, el.clientWidth / width));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={ref} style={{ height: height * scale }} className="w-full">
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}
