import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

// Удаление материала медиатеки: снимаем запись MediaAsset и файл из public/uploads/library.

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return bad("id: ожидался числовой id");

  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (asset) {
    // basename отсекает каталоги — из url в файловый путь попадает только имя, без обхода вверх
    const file = path.basename(asset.url);
    await fs.unlink(path.join(process.cwd(), "public", "uploads", "library", file)).catch(() => {});
    await prisma.mediaAsset.delete({ where: { id } });
  }
  return NextResponse.json({ ok: true });
}
