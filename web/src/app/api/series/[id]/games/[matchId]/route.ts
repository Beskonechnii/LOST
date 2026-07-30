import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncMatch } from "@/lib/match-sync";
import { detachGame } from "@/lib/series";

/**
 * Перечитать карту из OpenDota. Нужно, когда отчёт дозрел: непарсенный матч через какое-то время
 * обрастает вардами, стаками и таймингами, а привязка их уже не увидит — она была раньше.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  try {
    return NextResponse.json({ ok: true, ...(await syncMatch(prisma, Number(matchId))) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

/** Отцепить карту от серии. Если на матче висят генерации или баллы — он остаётся, но без серии. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  try {
    await detachGame(Number(matchId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
