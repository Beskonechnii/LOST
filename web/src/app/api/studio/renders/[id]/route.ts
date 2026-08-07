import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, parseId } from "@/lib/api";

// Удалить сохранённую генерацию из истории студии. Payload формы — не сущность лиги, а черновик,
// поэтому чистить её из истории безопасно. Запись за паролем (не-GET к /api/* закрыт в proxy).

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const { count } = await prisma.render.deleteMany({ where: { id } }); // deleteMany идемпотентен: нет строки — не падаем
  if (!count) return bad("Генерация не найдена", 404);
  return NextResponse.json({ ok: true });
}
