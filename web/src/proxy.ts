import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, needsAdmin, verifyToken } from "@/lib/auth";

// Защита админки. В Next 16 это `proxy.ts` (бывший `middleware.ts`, переименован в v16)
// и по умолчанию он идёт на Node-рантайме — поэтому `node:crypto` внутри lib/auth работает.
//
// Здесь только развилка «пускать или нет». Что именно закрыто — в lib/auth.ts (`needsAdmin`),
// чтобы список защищённого не разъезжался между proxy и самими роутами.

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!needsAdmin(pathname, request.method)) return NextResponse.next();
  if (verifyToken(request.cookies.get(ADMIN_COOKIE)?.value)) return NextResponse.next();

  // API отвечает кодом, а не редиректом: fetch из формы должен получить внятную 401,
  // а не HTML страницы логина.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Нужен вход в админку" }, { status: 401 });
  }

  const login = new URL("/admin/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`); // после входа вернём куда шли
  return NextResponse.redirect(login);
}

export const config = {
  // Статику и загруженные картинки не трогаем: публичные ассеты и так публичны,
  // а прогонять через проверку каждый PNG — лишняя работа на каждый запрос.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/|uploads/|templates/).*)"],
};
