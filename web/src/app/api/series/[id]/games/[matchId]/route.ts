import { NextResponse } from "next/server";
import { detachGame, resyncGame } from "@/lib/series";
import { guard } from "@/lib/api-guard";

/**
 * Перечитать карту из OpenDota. Когда это нужно и что при этом перезаписывается — правила живут
 * одним местом, в `resyncGame` (src/lib/series.ts), а не размазаны по роуту и кнопке.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const denied = await guard("series.edit");
  if (denied) return denied;
  const { matchId } = await params;
  try {
    return NextResponse.json({ ok: true, ...(await resyncGame(Number(matchId))) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

/** Отцепить карту от серии. Если на матче висят генерации или баллы — он остаётся, но без серии. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const denied = await guard("series.edit");
  if (denied) return denied;
  const { matchId } = await params;
  try {
    await detachGame(Number(matchId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
