import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseId } from "@/lib/api";
import { syncMatch } from "@/lib/match-sync";
import { guard } from "@/lib/api-guard";

// Админ-эндпоинт: синк матча из OpenDota. Дёргается «перечитать карту» в архиве серий — потому и
// право series.edit: результат синка ложится в стату турнира, а не в чей-то черновик.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard("series.edit");
  if (denied) return denied;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "id: ожидался числовой id" }, { status: 400 });
  try {
    const result = await syncMatch(prisma, id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}
