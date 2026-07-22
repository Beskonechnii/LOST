import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listTeams } from "@/lib/roster-data";
import { slugify } from "@/lib/profiles";

export async function GET() {
  return NextResponse.json(await listTeams());
}

// Создание команды. slug — из названия, если не задан явно; он же ключ импорта составов.
export async function POST(req: Request) {
  const body = (await req.json()) as { name?: string; slug?: string; tag?: string; group?: string; color?: string };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Нужно название команды" }, { status: 400 });

  const slug = body.slug?.trim() || slugify(name);
  if (!slug) return NextResponse.json({ error: "Не удалось вывести slug — задайте вручную" }, { status: 400 });
  if (await prisma.team.findUnique({ where: { slug } })) {
    return NextResponse.json({ error: `Команда со слагом «${slug}» уже есть` }, { status: 409 });
  }

  const team = await prisma.team.create({
    data: { slug, name, tag: body.tag || null, group: body.group || null, color: body.color || null },
  });
  return NextResponse.json(team, { status: 201 });
}
