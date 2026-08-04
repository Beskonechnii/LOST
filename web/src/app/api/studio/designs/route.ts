import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emptyDoc, normalizeDoc } from "@/studio/editor/model";

// Документы редактора: GET — список (без тяжёлого doc), POST — создать новый.
// doc хранится JSON-строкой в Design.doc (как Render.payload).

export async function GET() {
  const items = await prisma.design.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { title?: string; w?: number; h?: number };
  const doc = normalizeDoc(emptyDoc(body.w, body.h));
  const design = await prisma.design.create({
    data: { title: body.title?.trim() || null, doc: JSON.stringify(doc) },
  });
  return NextResponse.json(design, { status: 201 });
}
