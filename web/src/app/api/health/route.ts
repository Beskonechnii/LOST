import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Проверка связки Next → Prisma → SQLite. Позже заменим на реальные роуты.
export async function GET() {
  const [teams, matches, points] = await Promise.all([
    prisma.team.count(),
    prisma.match.count(),
    prisma.pointsEntry.count(),
  ]);
  return NextResponse.json({ ok: true, teams, matches, points });
}
