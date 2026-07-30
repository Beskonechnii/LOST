import { NextResponse } from "next/server";
import { createSeries, listSeries } from "@/lib/series";
import { isBracket, isStage } from "@/lib/stages";

/** Архив встреч. Чтение публичное (как и таблица), фильтры — теми же именами, что в URL страниц. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const stage = q.get("stage");
  const bracket = q.get("bracket");
  return NextResponse.json(
    await listSeries({
      division: q.get("division") ?? undefined,
      stage: isStage(stage) ? stage : undefined,
      group: q.get("group") ?? undefined,
      bracket: isBracket(bracket) ? bracket : undefined,
      teamId: q.get("teamId") ? Number(q.get("teamId")) : undefined,
    }),
  );
}

/** Завести встречу руками — в первую очередь плей-офф: групповые залиты импортом таблицы сезона. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const series = await createSeries({
      division: String(body.division ?? ""),
      stage: String(body.stage ?? ""),
      group: body.group ? String(body.group) : null,
      round: body.round ? String(body.round) : null,
      playedAt: body.playedAt ? new Date(body.playedAt) : null,
      homeId: Number(body.homeId),
      awayId: Number(body.awayId),
      score: String(body.score ?? ""),
    });
    return NextResponse.json({ ok: true, series });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
