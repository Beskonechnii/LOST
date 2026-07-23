import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Редактируемые поля профиля команды. Всё, чего нет в теле запроса, не трогаем.
const FIELDS = ["name", "tag", "group", "color", "logo", "wordmark", "photo"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Record<string, string | null>;

  const data: Record<string, string | null> = {};
  for (const f of FIELDS) {
    if (f in body) data[f] = body[f]?.toString().trim() || null;
  }
  if (data.name === null) return NextResponse.json({ error: "Название не может быть пустым" }, { status: 400 });

  const team = await prisma.team.update({ where: { id: Number(id) }, data });
  return NextResponse.json(team);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teamId = Number(id);

  // Команду с матчами не удаляем: на неё ссылается история (Match, MatchStat через игроков).
  const matches = await prisma.match.count({
    where: { OR: [{ teamAId: teamId }, { teamBId: teamId }] },
  });
  if (matches > 0) {
    return NextResponse.json({ error: `У команды ${matches} матч(ей) — удаление сломает историю` }, { status: 409 });
  }

  // Места в составе уходят каскадом, сами карточки игроков остаются в базе.
  await prisma.team.delete({ where: { id: teamId } });
  return NextResponse.json({ ok: true });
}
