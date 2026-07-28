import { NextResponse } from "next/server";
import {
  dropEntry,
  isShotKind,
  listEntries,
  safeMatchId,
  saveShot,
  type ArchiveMeta,
} from "@/lib/postgame-archive";

// Полка выгруженных постгеймов: GET — список, POST — положить свежий PNG, DELETE — убрать матч.
// PNG приходит готовым с клиента: он снимается там же, где рисуется превью (modern-screenshot),
// поэтому «что видел — то и в архиве». Серверу остаётся проверить формат и записать файл.

const MAX_BYTES = 16 * 1024 * 1024; // 1920×1080 PNG — единицы мегабайт, запас на тяжёлые подложки

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function GET() {
  return NextResponse.json({ ok: true, items: await listEntries() });
}

export async function POST(req: Request) {
  const form = await req.formData();

  const kind = form.get("kind");
  if (!isShotKind(kind)) return bad("kind: ожидалось summary|players");

  const file = form.get("file");
  if (!(file instanceof File)) return bad("file: не пришёл файл");
  if (file.type !== "image/png") return bad(`Ожидался PNG, пришло ${file.type || "?"}`, 415);
  if (file.size > MAX_BYTES) return bad(`Файл больше ${MAX_BYTES / 1024 / 1024} МБ`, 413);

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(String(form.get("meta") ?? "")) as Record<string, unknown>;
  } catch {
    return bad("meta: не разобрался JSON");
  }

  const matchId = safeMatchId(raw.matchId);
  if (!matchId) return bad("meta.matchId: ожидался числовой id матча");

  // Подпись собираем сами, а не доверяем присланному объекту: в имя файла и на полку
  // должны попасть только известные поля известных типов.
  const meta: ArchiveMeta = {
    matchId,
    source: raw.source === "steam" ? "steam" : "opendota",
    radiant: String(raw.radiant ?? "").trim() || "Свет",
    dire: String(raw.dire ?? "").trim() || "Тьма",
    radiantScore: Number(raw.radiantScore) || 0,
    direScore: Number(raw.direScore) || 0,
    radiantWin: raw.radiantWin === true,
    savedAt: Date.now(),
  };

  await saveShot(meta, kind, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ ok: true, matchId, kind });
}

export async function DELETE(req: Request) {
  const matchId = safeMatchId(new URL(req.url).searchParams.get("matchId"));
  if (!matchId) return bad("matchId: ожидался числовой id матча");
  await dropEntry(matchId);
  return NextResponse.json({ ok: true });
}
