"use client";

// Клиентский лист-компонент иконки для скорборда: onError (фолбэк на CDN Valve) требует клиента.
// Держим его отдельным «use client»-файлом, чтобы сам шаблон postgame-board оставался общим модулем
// (иначе его экспорт TemplateDef на сервере превращается в client-reference и getTemplate его не видит —
// страница мастера падает в notFound). Тот же приём, что у Bg/TeamPhoto в parts.tsx.

import { assetUrl, assetFallback, type AssetKind } from "@/lib/assets";

export function Icon({
  kind,
  slug,
  name,
  w,
  h,
  radius = 4,
  round = false,
}: {
  kind: AssetKind;
  slug: string;
  name: string;
  w: number;
  h: number;
  radius?: number;
  round?: boolean;
}) {
  const r = round ? 999 : radius;
  if (!slug) return <div style={{ width: w, height: h, borderRadius: r, background: "rgba(255,255,255,.06)" }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={assetUrl(kind, slug)}
      alt={name}
      title={name}
      width={w}
      height={h}
      style={{ width: w, height: h, objectFit: "cover", borderRadius: r, background: "#0d0718" }}
      onError={(e) => {
        const el = e.currentTarget as HTMLImageElement;
        const fb = assetFallback(kind, slug);
        if (el.src !== fb) el.src = fb;
      }}
    />
  );
}
