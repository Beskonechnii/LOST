import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyEmail, effectiveRole, isOwnerEmail } from "@/lib/account";
import { setSessionCookie } from "@/lib/player-session";

// Переход по ссылке из письма-подтверждения. Route handler (а не страница), потому что тут ставится
// сессионная кука — в рендере серверного компонента куки менять нельзя, только в роуте/экшене.
// Успех: почта подтверждена, выдаём сессию и уводим в кабинет. Провал (токен протух/чужой) → /me с ?error.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const accountId = await verifyEmail(token);
  if (accountId == null) return NextResponse.redirect(new URL("/me?error=verify", req.url));

  // Роль для куки — эффективная (владельца по OWNER_EMAIL закрепляем в БД, как в OAuth-callback).
  const account = await prisma.userAccount.findUnique({ where: { id: accountId } });
  if (account) {
    if (isOwnerEmail(account.email) && account.role !== "owner") {
      await prisma.userAccount.update({ where: { id: account.id }, data: { role: "owner" } });
    }
    await setSessionCookie(account.id, effectiveRole(account));
  }
  return NextResponse.redirect(new URL("/me?ok=verified", req.url));
}
