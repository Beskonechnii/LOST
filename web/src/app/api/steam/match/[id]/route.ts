import { matchReportResponse } from "@/lib/match-api";

// Тот же отчёт, что и /api/opendota/match/[id], но из первоисточника Valve.
// Запасной путь на случай аварии OpenDota; часть данных беднее — см. lib/steam-match.ts.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return matchReportResponse(req, "steam", id);
}
