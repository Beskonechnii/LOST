import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRole } from "@/lib/roles";
import { spotConflict } from "@/lib/roster-spots";

/** Поставить игрока в состав команды. */
export async function POST(req: Request) {
  const body = (await req.json()) as { playerId?: number; teamId?: number; role?: string | null };
  const playerId = Number(body.playerId);
  const teamId = Number(body.teamId);
  if (!playerId || !teamId) return NextResponse.json({ error: "Нужны playerId и teamId" }, { status: 400 });

  const role = body.role === null || body.role === "" ? null : String(body.role);
  if (role !== null && !isRole(role)) return NextResponse.json({ error: `Неизвестная роль «${role}»` }, { status: 400 });

  if (await prisma.rosterSpot.findUnique({ where: { teamId_playerId: { teamId, playerId } } })) {
    return NextResponse.json({ error: "Игрок уже в этом составе" }, { status: 409 });
  }

  const [existing, target] = await Promise.all([
    prisma.rosterSpot.findMany({ where: { playerId }, include: { team: { select: { name: true, group: true } } } }),
    prisma.team.findUnique({ where: { id: teamId }, select: { group: true } }),
  ]);
  const conflict = spotConflict(
    existing.map((s) => ({ teamId: s.teamId, role: s.role, teamName: s.team.name, division: s.team.group })),
    { teamId, role, division: target?.group ?? null },
  );
  if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

  const spot = await prisma.rosterSpot.create({ data: { playerId, teamId, role } });
  return NextResponse.json(spot, { status: 201 });
}
