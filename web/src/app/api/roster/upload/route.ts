import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { uploadUrl, type UploadKind } from "@/lib/profiles";

// Загрузка картинки профиля: multipart { kind: teams|players, file } → файл в public/uploads + путь.
// Путь дальше кладётся в Team.logo / Team.wordmark / Team.photo / Player.photo.

const MAX_BYTES = 8 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

export async function POST(req: Request) {
  const form = await req.formData();
  const kind = String(form.get("kind") ?? "") as UploadKind;
  const file = form.get("file");

  if (kind !== "teams" && kind !== "players") {
    return NextResponse.json({ error: "kind: ожидалось teams|players" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file: не пришёл файл" }, { status: 400 });
  }
  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    return NextResponse.json({ error: `Формат ${file.type || "?"} не поддержан: png, jpeg или webp` }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `Файл больше ${MAX_BYTES / 1024 / 1024} МБ` }, { status: 413 });
  }

  const name = `${randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", kind);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ path: uploadUrl(kind, name) });
}
