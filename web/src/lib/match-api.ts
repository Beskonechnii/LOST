// Только сервер: общий обработчик для /api/opendota/match/[id] и /api/steam/match/[id].
//
// Оба роута делают одно и то же и отличаются только источником, поэтому порядок «проверить id →
// отдать с полки → занять слот лимита → сходить наружу → положить на полку» описан здесь один раз:
// разъехаться кэшу с лимитом в двух копиях — вопрос времени.

import { NextResponse } from "next/server";
import { isFinalReport, readCachedReport, writeCachedReport, type MatchSource } from "./match-cache";
import { fetchMatchReport, type MatchReport } from "./opendota";
import { clientIp, takeSlot } from "./rate-limit";

const LOADERS: Record<MatchSource, (matchId: string) => Promise<MatchReport>> = {
  opendota: fetchMatchReport,
  // Импорт ленивый: Steam-путь запасной, а модуль читает STEAM_API_KEY — незачем тянуть его
  // в память на каждый запрос к OpenDota.
  steam: async (matchId) => (await import("./steam-match")).fetchSteamMatchReport(matchId),
};

/** Финальный отчёт неизменен — пусть браузер и прокси тоже его подержат. */
const cacheHeader = (final: boolean) =>
  final ? { "Cache-Control": "public, max-age=3600" } : { "Cache-Control": "no-store" };

export async function matchReportResponse(req: Request, source: MatchSource, rawId: string) {
  const matchId = rawId.trim();
  // id матча у Valve — только цифры. Отсекаем до кэша и до лимита: это не «матч не найден».
  if (!/^\d{1,20}$/.test(matchId)) {
    return NextResponse.json({ ok: false, error: "ID матча — это число, например 8907510684" }, { status: 400 });
  }

  const cached = await readCachedReport(source, matchId);
  if (cached) {
    return NextResponse.json({ ok: true, match: cached, cached: true }, { headers: cacheHeader(isFinalReport(source, cached)) });
  }

  // Слот занимаем только теперь: отдача с полки лимит не расходует (см. lib/rate-limit.ts).
  const slot = takeSlot(clientIp(req));
  if (!slot.ok) {
    return NextResponse.json(
      { ok: false, error: `Слишком часто. Попробуй через ${slot.retryAfterSec} с.` },
      { status: 429, headers: { "Retry-After": String(slot.retryAfterSec) } },
    );
  }

  try {
    const match = await LOADERS[source](matchId);
    await writeCachedReport(source, matchId, match);
    return NextResponse.json({ ok: true, match }, { headers: cacheHeader(isFinalReport(source, match)) });
  } catch (e) {
    // Сообщения из lib/opendota.ts и lib/steam-match.ts уже написаны для человека — отдаём как есть.
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
