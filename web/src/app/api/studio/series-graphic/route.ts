import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSeriesData, fillDoc } from "@/lib/series-graphic";
import { normalizeDoc } from "@/studio/editor/model";

// Собрать графику серии из мастер-шаблона: по {seriesId, kind} клонирует мастер (Design с этим kind
// и пустым seriesId), подставляет данные серии, создаёт инстанс (Design с seriesId+kind) и отдаёт id.
// Повтор не плодит копии — возвращает уже созданный инстанс: графика серии живёт «в одном месте».

const KINDS = new Set(["announce", "announce2", "score", "result"]);
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { seriesId?: number; kind?: string; mapNumber?: number };
  const seriesId = Number(body.seriesId);
  const kind = String(body.kind ?? "");
  if (!seriesId || !KINDS.has(kind)) return bad("Нужны seriesId и kind (announce|announce2|score|result)");

  // score — по каждой карте (счёт накопительный), поэтому у него ключ включает номер карты;
  // остальные типы — один на серию (mapNumber = null).
  const mapNumber = kind === "score" ? Number(body.mapNumber) || null : null;
  if (kind === "score" && !mapNumber) return bad("Для счёта нужен mapNumber (номер карты)");

  // уже собранная графика этого типа/карты — открываем её, а не делаем дубль
  const existing = await prisma.design.findFirst({ where: { seriesId, kind, mapNumber }, select: { id: true } });
  if (existing) return NextResponse.json({ id: existing.id, existed: true });

  const master = await prisma.design.findFirst({ where: { kind, seriesId: null }, select: { doc: true } });
  if (!master) return bad(`Нет мастер-шаблона «${kind}». Заведите его в редакторе и пометьте kind.`, 404);

  const data = await buildSeriesData(seriesId, mapNumber ?? undefined);
  if (!data) return bad("Серия не найдена", 404);

  const suffix = mapNumber ? ` · карта ${mapNumber}` : "";
  const doc = fillDoc(normalizeDoc(JSON.parse(master.doc)), data);
  const design = await prisma.design.create({
    data: { title: `${kindLabel(kind)} · ${data.title}${suffix}`, doc: JSON.stringify(doc), kind, seriesId, mapNumber },
  });
  return NextResponse.json({ id: design.id, existed: false }, { status: 201 });
}

function kindLabel(kind: string): string {
  return kind === "announce" ? "Анонс" : kind === "announce2" ? "Анонс 2" : kind === "score" ? "Счёт" : "Итог";
}
