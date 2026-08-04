// Чистый рендер одного элемента в натуральных пикселях — без интерактива.
// Тот же компонент рисует и превью на экране (внутри отмасштабированного узла), и PNG-снимок:
// узел один, поэтому «что вижу — то и скачал». Стиль inline, как в шаблонах студии (parts.tsx).

import type { CSSProperties } from "react";
import type { Element } from "./model";

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
  if (el.type === "text") {
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
          style={{
            width: "100%",
            color: el.color,
            fontFamily: el.font,
            fontSize: el.size,
            fontWeight: el.weight,
            lineHeight: el.lineHeight,
            letterSpacing: el.letterSpacing,
            textAlign: el.align,
            textTransform: el.uppercase ? "uppercase" : "none",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {el.text}
        </span>
      </div>
    );
  }

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
