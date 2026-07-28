import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Удалить сохранённую генерацию из истории студии. Payload формы — не сущность лиги, а черновик,
// поэтому чистить её из истории безопасно. Запись за паролем (не-GET к /api/* закрыт в proxy).

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.render.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
