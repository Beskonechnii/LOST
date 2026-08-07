import { NextResponse } from "next/server";
import { parseId } from "@/lib/api";
import { attachGame } from "@/lib/series";

/**
 * Привязать карту к серии: `{ gameNumber, openDotaMatchId }`. Стата читается тут же — отдельной
 * кнопки «синхронизировать» нет намеренно: карта без статы в архиве бесполезна.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "id: ожидался числовой id" }, { status: 400 });
  try {
    const body = await req.json();
    const result = await attachGame(id, Number(body.gameNumber), String(body.openDotaMatchId ?? "").trim());
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
