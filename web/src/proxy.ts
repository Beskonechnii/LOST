import { NextResponse, type NextRequest } from "next/server";
import { needsAdmin } from "@/lib/auth";
import { SESSION_COOKIE, sessionIsAdmin } from "@/lib/player-auth";

// Защита служебной части. В Next 16 это `proxy.ts` (бывший `middleware.ts`, переименован в v16)
// и по умолчанию он идёт на Node-рантайме — поэтому `node:crypto` внутри player-auth работает.
//
// Единственный вход — через Google (кабинет /me); пароля-админки больше нет. Пускаем только сессию
// с ролью owner/admin (роль вшита в подписанную куку, решается чистой криптой без БД). Что закрыто —
// в lib/auth.ts (`needsAdmin`), чтобы список защищённого не разъезжался между proxy и роутами.

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!needsAdmin(pathname, request.method)) return NextResponse.next();
  if (sessionIsAdmin(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  // Dev-автовход (DEV_LOGIN_EMAIL, см. player-session.ts): пропускаем без куки — роль и права всё
  // равно решит страница/роут по БД. На production переменная не действует.
  if (process.env.NODE_ENV !== "production" && (process.env.DEV_LOGIN_EMAIL ?? "").trim()) {
    return NextResponse.next();
  }

  // API отвечает кодом, а не редиректом: fetch из формы должен получить внятную 401,
  // а не HTML страницы входа.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Нужны права администратора" }, { status: 401 });
  }

  // Не админ — уводим в кабинет: там единственный вход. `next` сохраняем на будущее (страница входа
  // пока просто показывает кабинет и после входа ведёт в админку сама).
  const login = new URL("/me", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Статику и загруженные картинки не трогаем: публичные ассеты и так публичны,
  // а прогонять через проверку каждый PNG — лишняя работа на каждый запрос.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/|uploads/|templates/).*)"],
};
