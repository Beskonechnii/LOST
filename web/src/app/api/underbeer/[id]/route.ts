import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DRAFT_VERSION, type DraftState } from "@/lib/draft";

// Одна сессия драфта: чтение, автосейв состояния (payload) по каждому ходу, удаление.
// Правила хода живут в src/lib/draft.ts и применяются на клиенте — сюда прилетает уже готовое
// состояние. Сервер лишь проверяет версию формата и что это валидный JSON, а не источник истины
// правил: борд эфемерный, гонок между операторами тут нет (один оператор на эфире).

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await prisma.draftSession.findUnique({ where: { id: Number(id) } });
  if (!session) return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
  return NextResponse.json(session);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { payload?: DraftState; title?: string; status?: string };

  const data: { payload?: string; title?: string | null; status?: string } = {};
  if (body.payload !== undefined) {
    if (body.payload?.version !== DRAFT_VERSION) {
      return NextResponse.json({ error: "Несовместимая версия состояния драфта" }, { status: 400 });
    }
    data.payload = JSON.stringify(body.payload);
    data.status = body.payload.phase === "done" ? "done" : "draft";
  }
  if (body.title !== undefined) data.title = body.title.trim() || null;
  if (body.status !== undefined) data.status = body.status;

  const saved = await prisma.draftSession.update({ where: { id: Number(id) }, data });
  return NextResponse.json(saved);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.draftSession.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
