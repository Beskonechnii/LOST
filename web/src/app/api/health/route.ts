import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Проверка связки Next → Prisma → SQLite: счётчики команд/матчей/баллов. Зовётся лендингом.
export async function GET() {
  const [teams, matches, points] = await Promise.all([
    prisma.team.count(),
    prisma.match.count(),
    prisma.pointsEntry.count(),
  ]);
  return NextResponse.json({ ok: true, teams, matches, points });
}
