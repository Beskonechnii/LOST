import { NextResponse } from "next/server";
import { fetchMatchReport } from "@/lib/opendota";

// Каркас: вставил match_id → полный отчёт из OpenDota. Ничего не выдумываем.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json({ ok: true, match: await fetchMatchReport(id.trim()) });
  } catch (e) {
    // Сообщения из lib/opendota.ts уже написаны для человека — отдаём их как есть, без «Error: ».
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
