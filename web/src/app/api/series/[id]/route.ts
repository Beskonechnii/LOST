import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bad, parseId } from "@/lib/api";
import { VALID_SCORES } from "@/lib/series";

/**
 * Поправить счёт встречи. Кросс-таблица сезона не подписана, пары групповой стадии восстановлены
 * расчётом — правка здесь считается подтверждением: снимаем пометку «под вопросом».
 * `flipped` — счёт пришёл со стороны гостя, разворачиваем перед записью.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return bad("id: ожидался числовой id");
  const body = (await req.json()) as { score?: string; flipped?: boolean };
  const score = String(body.score ?? "");
  if (!VALID_SCORES.includes(score)) {
    return bad(`Счёт серии должен быть ${VALID_SCORES.join(", ")} — не «${score}»`);
  }

  const [a, b] = score.split(":").map(Number);
  const [homeScore, awayScore] = body.flipped ? [b, a] : [a, b];

  const { count } = await prisma.series.updateMany({
    where: { id },
    data: { homeScore, awayScore, guessed: false },
  });
  if (!count) return bad("Встреча не найдена", 404);
  return NextResponse.json(await prisma.series.findUnique({ where: { id } }));
}

/** Снести встречу целиком — вместе с её картами: без серии карте в архиве места нет. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const seriesId = parseId((await params).id);
  if (!seriesId) return bad("id: ожидался числовой id");
  await prisma.match.deleteMany({ where: { seriesId } });
  const { count } = await prisma.series.deleteMany({ where: { id: seriesId } });
  if (!count) return bad("Встреча не найдена", 404);
  return NextResponse.json({ ok: true });
}
