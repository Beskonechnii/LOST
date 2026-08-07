import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, parseId } from "@/lib/api";
import { isColor } from "@/lib/profiles";

// Редактируемые поля профиля команды. Всё, чего нет в теле запроса, не трогаем.
const FIELDS = ["name", "tag", "group", "color", "logo", "wordmark", "photo"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const body = (await req.json()) as Record<string, string | null>;

  const data: Record<string, string | null> = {};
  for (const f of FIELDS) {
    if (f in body) data[f] = body[f]?.toString().trim() || null;
  }
  if (data.name === null) return bad("Название не может быть пустым");
  // color уходит в CSS-стили карточек — пускаем только hex, иначе можно вписать что угодно в стиль
  if (data.color && !isColor(data.color)) return bad(`Цвет «${data.color}» — ожидался hex, например #7c3aed`);

  const { count } = await prisma.team.updateMany({ where: { id }, data });
  if (!count) return bad("Команда не найдена", 404);
  return NextResponse.json(await prisma.team.findUnique({ where: { id } }));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teamId = parseId((await params).id);
  if (!teamId) return bad("id: ожидался числовой id");

  // Команду с матчами не удаляем: на неё ссылается история (Match, MatchStat через игроков).
  const matches = await prisma.match.count({
    where: { OR: [{ teamAId: teamId }, { teamBId: teamId }] },
  });
  if (matches > 0) {
    return bad(`У команды ${matches} матч(ей) — удаление сломает историю`, 409);
  }

  // Места в составе уходят каскадом, сами карточки игроков остаются в базе.
  const { count } = await prisma.team.deleteMany({ where: { id: teamId } });
  if (!count) return bad("Команда не найдена", 404);
  return NextResponse.json({ ok: true });
}
