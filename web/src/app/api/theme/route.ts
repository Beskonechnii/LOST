import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { readTheme, writeTheme } from "@/lib/theme-store";
import { normalizeTheme } from "@/lib/theme";

// Тема UI: чтение и запись data/theme.json. GET открыт (публичная палитра), запись (PUT) закрыта
// паролем как любой не-GET к /api (см. src/lib/auth.ts). Значения санитайзятся в normalizeTheme.

export async function GET() {
  return NextResponse.json(await readTheme());
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ожидался объект темы" }, { status: 400 });
  }
  const theme = normalizeTheme(body);
  await writeTheme(theme);
  // Тема живёт в корневом layout — перечитать надо весь сайт, отсюда путь "/" со scope "layout".
  revalidatePath("/", "layout");
  return NextResponse.json(theme);
}
