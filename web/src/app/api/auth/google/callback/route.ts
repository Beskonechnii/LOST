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

  // Аккаунт ищем сначала по googleSub, затем по email. Второе — чтобы вход через Google подхватил
  // уже заведённый парольный аккаунт с той же почтой (это тот же человек: Google подтверждает почту),
  // а не упёрся в уникальность email. Google-вход всегда поднимает emailVerified — почта доказана.
  const mail = user.email.trim().toLowerCase();
  const common = { email: mail, name: user.name ?? null, avatar: user.picture ?? null, emailVerified: true };
  const existing =
    (await prisma.userAccount.findUnique({ where: { googleSub: user.sub } })) ??
    (await prisma.userAccount.findUnique({ where: { email: mail } }));
  const account = existing
    ? await prisma.userAccount.update({ where: { id: existing.id }, data: { googleSub: user.sub, ...common } })
    : await prisma.userAccount.create({ data: { googleSub: user.sub, ...common } });

  // Владелец (OWNER_EMAIL) закрепляется в БД при входе — чтобы он был виден в панели как owner,
  // а не только жил в куке. Роль для куки берём эффективную (owner по почте перекрывает запись).
  if (isOwnerEmail(account.email) && account.role !== "owner") {
    await prisma.userAccount.update({ where: { id: account.id }, data: { role: "owner" } });
  }
  await setSessionCookie(account.id, effectiveRole(account));
  return NextResponse.redirect(new URL("/me", req.url));
}
