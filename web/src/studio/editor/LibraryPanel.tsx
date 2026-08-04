"use client";

import { useEffect, useRef, useState } from "react";
import { UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/app/_components/form";
import type { ElementType } from "./model";

// Левая панель: добавление статичных элементов и медиатека загруженных картинок.
// Клик по материалу добавляет image-элемент с этим src (локальный /uploads/library — годен для PNG-снимка).

type Media = { id: number; name: string; url: string; width: number | null; height: number | null };

/** Натуральные размеры картинки на клиенте — через объект Image, без загрузки на сервер. */
function readDimensions(file: File): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export function LibraryPanel({
  onAdd,
  onAddImage,
}: {
  onAdd: (type: ElementType) => void;
  onAddImage: (src: string, w: number | null, h: number | null) => void;
}) {
  const [media, setMedia] = useState<Media[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/api/studio/media");
      if (alive && res.ok) setMedia(((await res.json()) as { items: Media[] }).items);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.set("file", file);
    // размеры читаем на клиенте — сервер не парсит картинки ради пропорций при расстановке
    const dims = await readDimensions(file);
    if (dims) {
      body.set("width", String(dims.w));
      body.set("height", String(dims.h));
    }
    const res = await fetch("/api/studio/media", { method: "POST", body });
    const json = (await res.json()) as { item?: Media; error?: string };
    setBusy(false);
    if (!res.ok || !json.item) setError(json.error ?? "Не удалось загрузить");
    else setMedia((m) => [json.item as Media, ...m]);
  }

  return (
    <div className="space-y-5">
      <div>
        <Label>Добавить</Label>
        <div className="mt-1">
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => onAdd("text")}>
            + Текст
          </Button>
        </div>
      </div>

      <div>
        <Label>Медиатека</Label>
        {/* нативный input прячем — вид «Choose file» выбивается из стиля; клик отдаём кнопке */}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-1 w-full"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <UploadIcon />
          {busy ? "Загружаю…" : "Загрузить"}
        </Button>
        {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}

        <div className="mt-3 grid grid-cols-3 gap-2">
          {media.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.name}
              onClick={() => onAddImage(m.url, m.width, m.height)}
              className="grid aspect-square place-items-center overflow-hidden rounded border border-hairline bg-surface-1 transition hover:border-accent/50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={m.name} className="h-full w-full object-contain" />
            </button>
          ))}
          {media.length === 0 && !busy && (
            <p className="col-span-3 text-xs text-ink-subtle">Пусто. Загрузите надписи, фоны, декор.</p>
          )}
        </div>
      </div>
    </div>
  );
}
