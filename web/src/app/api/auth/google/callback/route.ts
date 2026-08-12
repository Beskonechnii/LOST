import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, googleConfigured } from "@/lib/google-oauth";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/player-session";
import { effectiveRole, isOwnerEmail } from "@/lib/account";

// Возврат от Google: сверяем state, меняем код на профиль, заводим/находим аккаунт по googleSub,
// выдаём сессию и уводим на /me — там онбординг (новый профиль или заявка) или готовый кабинет.
// Ошибки не роняем страницей, а возвращаем на /me с ?error — форма покажет человеку, что случилось.

export const dynamic = "force-dynamic";

const back = (req: NextRequest, error: string) => NextResponse.redirect(new URL(`/me?error=${error}`, req.url));

export async function GET(req: NextRequest) {
  if (!googleConfigured()) return back(req, "off");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const jar = await cookies();
  const saved = jar.get("lost_oauth_state")?.value;
  jar.delete("lost_oauth_state"); // одноразовый: сразу гасим, повторно не пригодится
  if (!code || !state || !saved || state !== saved) return back(req, "state");

  let user;
  try {
    user = await exchangeCode(req.nextUrl.origin, code);
  } catch {
    return back(req, "google");
  }

  // Ключ аккаунта — googleSub (стабилен на весь срок аккаунта Google); email/имя/аватар обновляем,
  // они могут меняться на стороне Google.
  const account = await prisma.userAccount.upsert({
    where: { googleSub: user.sub },
    create: { googleSub: user.sub, email: user.email, name: user.name ?? null, avatar: user.picture ?? null },
    update: { email: user.email, name: user.name ?? null, avatar: user.picture ?? null },
  });

  // Владелец (OWNER_EMAIL) закрепляется в БД при входе — чтобы он был виден в панели как owner,
  // а не только жил в куке. Роль для куки берём эффективную (owner по почте перекрывает запись).
  if (isOwnerEmail(account.email) && account.role !== "owner") {
    await prisma.userAccount.update({ where: { id: account.id }, data: { role: "owner" } });
  }
  await setSessionCookie(account.id, effectiveRole(account));
  return NextResponse.redirect(new URL("/me", req.url));
}
