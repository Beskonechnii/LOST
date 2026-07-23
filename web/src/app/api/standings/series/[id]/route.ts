import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Счёт серии Bo3 — только эти четыре исхода; всё остальное отвергаем, чтобы в сетке
// не появилось значений, по которым не считаются очки.
const VALID = new Set(["2:0", "2:1", "1:2", "0:2"]);

/**
 * Поправить встречу руками. Кросс-таблица в таблице сезона не подписана, пары восстановлены
 * расчётом — правка здесь считается подтверждением: снимаем пометку «под вопросом».
 * `flipped` — счёт пришёл со стороны гостя, разворачиваем перед записью.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { score?: string; flipped?: boolean };
  const score = String(body.score ?? "");
  if (!VALID.has(score)) {
    return NextResponse.json({ error: `Счёт серии должен быть 2:0, 2:1, 1:2 или 0:2 — не «${score}»` }, { status: 400 });
  }

  const [a, b] = score.split(":").map(Number);
  const [homeScore, awayScore] = body.flipped ? [b, a] : [a, b];

  const series = await prisma.groupSeries.update({
    where: { id: Number(id) },
    data: { homeScore, awayScore, guessed: false },
  });
  return NextResponse.json(series);
}
