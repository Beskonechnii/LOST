import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncMatch } from "@/lib/match-sync";

// Админ-эндпоинт: синк матча из OpenDota. Позже дёргается кнопкой в админке.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await syncMatch(prisma, Number(id));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}
