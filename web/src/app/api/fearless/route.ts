import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Сессии fearless-драфта. Запись за паролем (needsAdmin в proxy.ts) — операторский инструмент.
// Пустой payload у новой сессии = борд стартует с экрана настройки (см. fearless-board.tsx).

export async function GET() {
  const sessions = await prisma.fearlessSession.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, status: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json(sessions);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const saved = await prisma.fearlessSession.create({
    data: { title: body.title?.trim() || null, payload: "" },
  });
  return NextResponse.json(saved, { status: 201 });
}
