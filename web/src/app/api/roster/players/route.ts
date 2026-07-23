import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listPlayers } from "@/lib/roster-data";
import { slugify } from "@/lib/profiles";
import { isRole } from "@/lib/roles";

export async function GET() {
  return NextResponse.json(await listPlayers());
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    nickname?: string;
    slug?: string;
    teamId?: number | null;
    accountId?: string;
    role?: string | null;
  };
  const nickname = body.nickname?.trim();
  if (!nickname) return NextResponse.json({ error: "Нужен ник игрока" }, { status: 400 });

  const slug = body.slug?.trim() || slugify(nickname);
  if (!slug) return NextResponse.json({ error: "Не удалось вывести slug — задайте вручную" }, { status: 400 });
  if (await prisma.player.findUnique({ where: { slug } })) {
    return NextResponse.json({ error: `Игрок со слагом «${slug}» уже есть` }, { status: 409 });
  }

  // Команду и роль здесь не заводим — это место в составе, оно ставится на карточке игрока (RosterSpot).
  const player = await prisma.player.create({
    data: { slug, nickname, accountId: body.accountId?.trim() || null },
  });
  if (body.teamId) {
    await prisma.rosterSpot.create({
      data: { playerId: player.id, teamId: body.teamId, role: isRole(body.role) ? body.role : null },
    });
  }
  return NextResponse.json(player, { status: 201 });
}
