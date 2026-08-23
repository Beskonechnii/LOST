import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { authUrl, googleConfigured } from "@/lib/google-oauth";

// Старт входа: кладём одноразовый state в куку и уводим на согласие Google. state сверим
// в callback — так чужой не подсунет свой код (защита от CSRF на OAuth).

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/me?error=off", req.url));
  }
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("lost_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600, // 10 минут на прохождение согласия — дольше держать смысла нет
  });
  return NextResponse.redirect(authUrl(req.nextUrl.origin, state));
}
