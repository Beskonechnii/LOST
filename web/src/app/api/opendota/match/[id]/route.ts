import { NextResponse } from "next/server";
import { fetchMatchReport } from "@/lib/opendota";

// Каркас: вставил match_id → полный отчёт из OpenDota. Ничего не выдумываем.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json({ ok: true, match: await fetchMatchReport(id.trim()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}
