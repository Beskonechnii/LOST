import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TEXT_FIELDS = [
  "nickname", "realName", "accountId", "photo", "telegram", "steamUrl", "dotabuffUrl", "stratzUrl",
] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  for (const f of TEXT_FIELDS) {
    if (f in body) data[f] = String(body[f] ?? "").trim() || null;
  }
  if ("position" in body) {
    const pos = Number(body.position);
    data.position = body.position === null || body.position === "" ? null : pos;
    if (data.position !== null && !(pos >= 1 && pos <= 5)) {
      return NextResponse.json({ error: "Позиция — число 1…5" }, { status: 400 });
    }
  }
  if ("isCaptain" in body) data.isCaptain = Boolean(body.isCaptain);
  if ("teamId" in body) data.teamId = body.teamId === null || body.teamId === "" ? null : Number(body.teamId);
  if (data.nickname === null) return NextResponse.json({ error: "Ник не может быть пустым" }, { status: 400 });

  const player = await prisma.player.update({ where: { id: Number(id) }, data });
  return NextResponse.json(player);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playerId = Number(id);

  // Игрока со статой не удаляем — на него ссылается MatchStat (история матчей).
  const stats = await prisma.matchStat.count({ where: { playerId } });
  if (stats > 0) {
    return NextResponse.json({ error: `У игрока стата по ${stats} матч(ам) — удаление сломает историю` }, { status: 409 });
  }

  await prisma.player.delete({ where: { id: playerId } });
  return NextResponse.json({ ok: true });
}
