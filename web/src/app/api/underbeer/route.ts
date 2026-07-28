import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { newDraftState } from "@/lib/draft";

// Сессии шоу-драфта UNDERBEER 2.0. Запись за паролем (needsAdmin в proxy.ts):
// это операторский инструмент, публике отдаём только «голый» рендер-оверлей.

export async function GET() {
  const sessions = await prisma.draftSession.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, status: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json(sessions);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const saved = await prisma.draftSession.create({
    data: { title: body.title?.trim() || null, payload: JSON.stringify(newDraftState()) },
  });
  return NextResponse.json(saved, { status: 201 });
}
