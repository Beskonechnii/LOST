import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseId } from "@/lib/api";
import { syncMatch } from "@/lib/match-sync";

// Админ-эндпоинт: синк матча из OpenDota. Позже дёргается кнопкой в админке.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "id: ожидался числовой id" }, { status: 400 });
  try {
    const result = await syncMatch(prisma, id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}
