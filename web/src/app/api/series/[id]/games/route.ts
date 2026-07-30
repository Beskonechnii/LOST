import { NextResponse } from "next/server";
import { attachGame } from "@/lib/series";

/**
 * Привязать карту к серии: `{ gameNumber, openDotaMatchId }`. Стата читается тут же — отдельной
 * кнопки «синхронизировать» нет намеренно: карта без статы в архиве бесполезна.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const result = await attachGame(Number(id), Number(body.gameNumber), String(body.openDotaMatchId ?? "").trim());
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
