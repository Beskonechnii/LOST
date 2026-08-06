import { NextResponse } from "next/server";
import { buildScoreboard } from "@/lib/scoreboard";

// Скорборд карты для мастера пост-гейм графики: мастер догружает его по выбору матча.
// Отчёт тяжёлый и серверный (кэш + лимит в match-api), поэтому клиент берёт готовый ScoreBoard.
export async function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("matchId"));
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Нужен matchId" }, { status: 400 });

  try {
    const board = await buildScoreboard(id);
    if (!board) return NextResponse.json({ error: "Карта не привязана к матчу OpenDota" }, { status: 404 });
    return NextResponse.json(board);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось собрать скорборд" }, { status: 502 });
  }
}
