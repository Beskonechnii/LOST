import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRole } from "@/lib/roles";
import { spotConflict } from "@/lib/roster-spots";
import { guard } from "@/lib/api-guard";
import { teamDivision } from "@/lib/tournaments";

/** Поставить игрока в состав команды. */
export async function POST(req: Request) {
  const denied = await guard("roster.edit");
  if (denied) return denied;
  const body = (await req.json()) as { playerId?: number; teamId?: number; role?: string | null };
  const playerId = Number(body.playerId);
  const teamId = Number(body.teamId);
  if (!playerId || !teamId) return NextResponse.json({ error: "Нужны playerId и teamId" }, { status: 400 });

  const role = body.role === null || body.role === "" ? null : String(body.role);
  if (role !== null && !isRole(role)) return NextResponse.json({ error: `Неизвестная роль «${role}»` }, { status: 400 });

  // Состав принадлежит дивизиону турнира: место заводим в тот дивизион, где команда играет сейчас.
  // Команда вне турнира — место без дивизиона (это законное состояние, см. схему).
  const division = await teamDivision(teamId);
  const divisionId = division?.id ?? null;

  if (await prisma.rosterSpot.findFirst({ where: { teamId, playerId, divisionId } })) {
    return NextResponse.json({ error: "Игрок уже в этом составе" }, { status: 409 });
  }

  const existing = await prisma.rosterSpot.findMany({
    where: { playerId },
    include: { team: { select: { name: true } } },
  });
  const conflict = spotConflict(
    existing.map((s) => ({ teamId: s.teamId, role: s.role, teamName: s.team.name, divisionId: s.divisionId })),
    { teamId, role, divisionId },
  );
  if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

  const spot = await prisma.rosterSpot.create({ data: { playerId, teamId, role, divisionId } });
  return NextResponse.json(spot, { status: 201 });
}
