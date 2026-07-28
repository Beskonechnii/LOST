import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRole } from "@/lib/roles";
import { spotConflict } from "@/lib/roster-spots";

/** Поменять роль или капитанство на месте в составе. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const spotId = Number(id);
  const body = (await req.json()) as Record<string, unknown>;

  const spot = await prisma.rosterSpot.findUnique({ where: { id: spotId }, include: { team: { select: { group: true } } } });
  if (!spot) return NextResponse.json({ error: "Место не найдено" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if ("role" in body) {
    const role = body.role === null || body.role === "" ? null : String(body.role);
    if (role !== null && !isRole(role)) return NextResponse.json({ error: `Неизвестная роль «${role}»` }, { status: 400 });

    // повышение до действующего может столкнуться с другой командой — проверяем до записи
    const others = await prisma.rosterSpot.findMany({
      where: { playerId: spot.playerId, id: { not: spotId } },
      include: { team: { select: { name: true, group: true } } },
    });
    const conflict = spotConflict(
      others.map((s) => ({ teamId: s.teamId, role: s.role, teamName: s.team.name, division: s.team.group })),
      { teamId: spot.teamId, role, division: spot.team.group },
    );
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });
    data.role = role;
  }
  if ("isCaptain" in body) data.isCaptain = Boolean(body.isCaptain);

  return NextResponse.json(await prisma.rosterSpot.update({ where: { id: spotId }, data }));
}

/** Убрать игрока из состава. Сама карточка игрока остаётся — со статой, фото и account_id. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.rosterSpot.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
