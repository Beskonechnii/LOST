import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VALID_SCORES } from "@/lib/series";

/**
 * Поправить счёт встречи. Кросс-таблица сезона не подписана, пары групповой стадии восстановлены
 * расчётом — правка здесь считается подтверждением: снимаем пометку «под вопросом».
 * `flipped` — счёт пришёл со стороны гостя, разворачиваем перед записью.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { score?: string; flipped?: boolean };
  const score = String(body.score ?? "");
  if (!VALID_SCORES.includes(score)) {
    return NextResponse.json({ error: `Счёт серии должен быть ${VALID_SCORES.join(", ")} — не «${score}»` }, { status: 400 });
  }

  const [a, b] = score.split(":").map(Number);
  const [homeScore, awayScore] = body.flipped ? [b, a] : [a, b];

  const series = await prisma.series.update({
    where: { id: Number(id) },
    data: { homeScore, awayScore, guessed: false },
  });
  return NextResponse.json(series);
}

/** Снести встречу целиком — вместе с её картами: без серии карте в архиве места нет. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seriesId = Number(id);
  await prisma.match.deleteMany({ where: { seriesId } });
  await prisma.series.delete({ where: { id: seriesId } });
  return NextResponse.json({ ok: true });
}
