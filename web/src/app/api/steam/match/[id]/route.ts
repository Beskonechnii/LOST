import { NextResponse } from "next/server";
import { fetchSteamMatchReport } from "@/lib/steam-match";

// Тот же отчёт, что и /api/opendota/match/[id], но из первоисточника Valve.
// Запасной путь на случай аварии OpenDota; часть данных беднее — см. lib/steam-match.ts.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json({ ok: true, match: await fetchSteamMatchReport(id.trim()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
