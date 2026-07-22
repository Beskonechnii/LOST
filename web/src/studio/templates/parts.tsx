"use client";

// Общие слои шаблонов: подложка, фото в рамке, wordmark/лого команды.
// Клиентские: подложка прячет себя через onError, пока bg.png не экспортирован из Figma.
// Все картинки — локальные (public), это условие корректного экспорта в PNG.

const FALLBACK_BG = "radial-gradient(1200px 800px at 30% 20%, #4c1d95 0%, #1b0b2e 55%, #0b0413 100%)";

/** Холст шаблона: фон из /templates/<id>/bg.png, пока его нет — фирменный градиент. */
export function Bg({
  templateId,
  w,
  h,
  children,
}: {
  templateId: string;
  w: number;
  h: number;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: w,
        height: h,
        overflow: "hidden",
        background: FALLBACK_BG,
        color: "#fff",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/templates/${templateId}/bg.png`}
        alt=""
        width={w}
        height={h}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      {children}
    </div>
  );
}

/** Фото команды/игрока в рамке-«скобках» с акцентом команды. */
export function TeamPhoto({
  src,
  accent,
  width,
  height,
}: {
  src: string | null;
  accent: string;
  width: number;
  height: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        alignSelf: "center",
        border: `3px solid ${accent}`,
        boxShadow: `0 0 60px ${accent}55`,
        background: "#150a24",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ color: "#6b21a8", font: "600 28px/1 var(--studio-font, system-ui)", letterSpacing: 2 }}>
          нет фото
        </span>
      )}
    </div>
  );
}

/** Название команды: wordmark-надпись, если загружена; иначе лого; иначе текст. */
export function Wordmark({
  src,
  logo,
  name,
  maxWidth,
  maxHeight,
}: {
  src: string | null;
  logo: string | null;
  name: string;
  maxWidth: number;
  maxHeight: number;
}) {
  const img = src ?? logo;
  if (img) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={img} alt="" style={{ maxWidth, maxHeight, objectFit: "contain" }} />;
  }
  return (
    <span
      style={{
        display: "block",
        maxWidth,
        color: "#c4a6ff",
        font: `900 ${Math.round(maxHeight * 0.45)}px/1 var(--studio-font, system-ui)`,
        textTransform: "uppercase",
        letterSpacing: -2,
        textShadow: "0 0 40px rgba(168,85,247,.5)",
      }}
    >
      {name || "TEAM"}
    </span>
  );
}
