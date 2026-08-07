import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, parseId } from "@/lib/api";
import { normalizeDoc } from "@/studio/editor/model";

// Один документ редактора: GET — читать, PUT — сохранить (title + doc), DELETE — удалить.

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
  const { count } = await prisma.design.updateMany({
    where: { id },
    data: { title: body.title?.trim() || null, doc: JSON.stringify(doc) },
  });
  if (!count) return bad("Документ не найден", 404);
  return NextResponse.json(await prisma.design.findUnique({ where: { id } }));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const { count } = await prisma.design.deleteMany({ where: { id } });
  if (!count) return bad("Документ не найден", 404);
  return NextResponse.json({ ok: true });
}
