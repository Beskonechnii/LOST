import { matchReportResponse } from "@/lib/match-api";

// Вставил match_id → полный отчёт из OpenDota. Ничего не выдумываем.
// Кэш, лимит по IP и заголовки — общие с запасным Steam-путём, см. lib/match-api.ts.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return matchReportResponse(req, "opendota", id);
}
