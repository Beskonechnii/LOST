import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTemplate } from "@/studio/registry";

// История генераций: payload формы, чтобы переоткрыть анонс и поправить, а не собирать заново.

export async function GET() {
  return NextResponse.json(await prisma.render.findMany({ orderBy: { createdAt: "desc" }, take: 50 }));
}

export async function POST(req: Request) {
  const body = (await req.json()) as { templateId?: string; payload?: unknown; title?: string; matchId?: number };
  const template = body.templateId ? getTemplate(body.templateId) : undefined;
  if (!template) return NextResponse.json({ error: "Неизвестный шаблон" }, { status: 400 });

  const saved = await prisma.render.create({
    data: {
      templateId: template.id,
      title: body.title?.trim() || template.title,
      payload: JSON.stringify(body.payload ?? {}),
      matchId: body.matchId ?? null,
    },
  });
  return NextResponse.json(saved, { status: 201 });
}
