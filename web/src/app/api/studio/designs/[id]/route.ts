import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeDoc } from "@/studio/editor/model";

// Один документ редактора: GET — читать, PUT — сохранить (title + doc), DELETE — удалить.

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const design = await prisma.design.findUnique({ where: { id } });
  if (!design) return bad("Документ не найден", 404);
  return NextResponse.json(design);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const body = (await req.json().catch(() => ({}))) as { title?: string; doc?: unknown };
  // нормализуем документ перед записью: кривой JSON от клиента не должен ложиться в БД как есть
  const doc = normalizeDoc(body.doc);
  const design = await prisma.design.update({
    where: { id },
    data: { title: body.title?.trim() || null, doc: JSON.stringify(doc) },
  });
  return NextResponse.json(design);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  await prisma.design.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
