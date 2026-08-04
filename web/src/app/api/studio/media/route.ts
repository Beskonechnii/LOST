import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Медиатека редактора: GET — список материалов, POST — загрузка картинки.
// Файл кладём в public/uploads/library (локально — обязательно для корректного PNG-снимка),
// метаданные — в MediaAsset. Размеры (width/height) читает клиент и присылает полями, чтобы
// не тянуть на сервер парсер картинок ради пропорций при расстановке.

const MAX_BYTES = 16 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};
const DIR = "library";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET() {
  const items = await prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return bad("file: не пришёл файл");

  const ext = EXT_BY_MIME[file.type];
  if (!ext) return bad(`Формат ${file.type || "?"} не поддержан: png, jpeg, webp или svg`, 415);
  if (file.size > MAX_BYTES) return bad(`Файл больше ${MAX_BYTES / 1024 / 1024} МБ`, 413);

  const name = `${randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", DIR);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));

  const width = Number(form.get("width")) || null;
  const height = Number(form.get("height")) || null;

  const item = await prisma.mediaAsset.create({
    data: {
      name: String(form.get("name") ?? file.name) || "материал",
      url: `/uploads/${DIR}/${name}`,
      width,
      height,
    },
  });
  return NextResponse.json({ item }, { status: 201 });
}
