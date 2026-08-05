"use client";

// Чистый рендер одного элемента в натуральных пикселях — без интерактива.
// Тот же компонент рисует и превью на экране (внутри отмасштабированного узла), и PNG-снимок:
// узел один, поэтому «что вижу — то и скачал». Стиль inline, как в шаблонах студии (parts.tsx).

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Element, TextEl } from "./model";

/** Абсолютный бокс элемента: позиция, размер, поворот вокруг центра, прозрачность. */
function boxStyle(el: Element): CSSProperties {
  return {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
    transform: `rotate(${el.rotation}deg)`,
    transformOrigin: "center center",
    opacity: el.opacity,
  };
}

export function ElementView({ el }: { el: Element }) {
  if (el.type === "text") return <TextView el={el} />;

  if (el.type === "image") {
    return (
      <div style={{ ...boxStyle(el), overflow: "hidden", borderRadius: el.radius }}>
        {el.src ? (
          // локальные картинки из public — оптимизация next/image не нужна и мешает PNG-снимку
          // eslint-disable-next-line @next/next/no-img-element
          <img src={el.src} alt="" style={{ width: "100%", height: "100%", objectFit: el.fit }} />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "grid",
              placeItems: "center",
              background: "#150a24",
              color: "#6b21a8",
              fontFamily: "var(--studio-font, system-ui)",
              fontSize: 24,
            }}
          >
            нет картинки
          </div>
        )}
      </div>
    );
  }

  // rect | ellipse
  return (
    <div
      style={{
        ...boxStyle(el),
        background: el.fill,
        borderRadius: el.type === "ellipse" ? "50%" : el.radius,
        border: el.stroke && el.strokeWidth > 0 ? `${el.strokeWidth}px solid ${el.stroke}` : undefined,
      }}
    />
  );
}

/**
 * Текстовый элемент. Обычно строка переносится (pre-wrap). При autoFit — одна строка, а кегль
 * ужимается по фактической ширине бокса: измеряем натуральную ширину и масштабируем шрифт, чтобы
 * длинное имя команды влезало в узкое окошко рамки. Работает и в превью, и в PNG-снимке (тот же DOM).
 */
function TextView({ el }: { el: TextEl }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);
  const [fontsReady, setFontsReady] = useState(false);

  // шрифт грузится асинхронно — до его готовности ширина считается по фолбэку; пересчитаем после
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => alive && setFontsReady(true));
    return () => {
      alive = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (!el.autoFit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (scale !== 1) setScale(1);
      return;
    }
    const span = ref.current;
    const parent = span?.parentElement;
    if (!span || !parent) return;
    // натуральная ширина строки при базовом кегле = текущая ширина / текущий масштаб (инвариант)
    const natural = span.scrollWidth / scale;
    const avail = parent.clientWidth;
    const next = natural > avail && natural > 0 ? Math.min(1, avail / natural) : 1;
    // измерить-и-подогнать: setState после замера DOM здесь по делу, сходится за один шаг (guard)
    if (Math.abs(next - scale) > 0.005) setScale(next);
  }, [el.autoFit, el.text, el.size, el.font, el.weight, el.w, el.letterSpacing, el.uppercase, scale, fontsReady]);

  return (
    <div
      style={{
        ...boxStyle(el),
        display: "flex",
        alignItems: "center",
        justifyContent: el.align === "left" ? "flex-start" : el.align === "right" ? "flex-end" : "center",
      }}
    >
      <span
        ref={ref}
        style={{
          width: el.autoFit ? "auto" : "100%",
          maxWidth: "100%",
          color: el.color,
          fontFamily: el.font,
          fontSize: el.autoFit ? el.size * scale : el.size,
          fontWeight: el.weight,
          lineHeight: el.lineHeight,
          letterSpacing: el.letterSpacing,
          textAlign: el.align,
          textTransform: el.uppercase ? "uppercase" : "none",
          whiteSpace: el.autoFit ? "nowrap" : "pre-wrap",
          wordBreak: el.autoFit ? "normal" : "break-word",
        }}
      >
        {el.text}
      </span>
    </div>
  );
}
