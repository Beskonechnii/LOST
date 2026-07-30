import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminConfigured, verifyToken } from "@/lib/auth";
import { LoginForm } from "./form";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

// Вход в админку. Публичная страница (см. needsAdmin) — иначе входить было бы некуда.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const authed = verifyToken((await cookies()).get(ADMIN_COOKIE)?.value);

  return (
    <main className="flex-1 p-4 md:p-8">
      <div className="mx-auto max-w-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300/80">Служебная часть</p>
        <h1 className="mt-1.5 text-xl font-bold tracking-tight">Админка LOST</h1>
        <p className="mt-1.5 mb-5 text-sm text-ink-muted">
          Пароль закрывает всё, что пишет: правку ростера, студию и запись через API. Публичная таблица,
          ростер и разбор матча открыты без него.
        </p>

        {!adminConfigured() ? (
          <p className="rounded-md border border-amber-900 bg-amber-950/40 px-3 py-2 text-sm text-amber-300">
            <code>ADMIN_PASSWORD</code> не задан в <code>web/.env</code> — вход невозможен, админка закрыта.
          </p>
        ) : authed ? (
          <form action={logout} className="space-y-3">
            <p className="rounded-md border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
              Вход выполнен.
            </p>
            <button
              type="submit"
              className="rounded-md border border-hairline-strong px-4 py-2 text-sm font-medium text-ink-muted hover:border-hairline-strong hover:text-white"
            >
              Выйти
            </button>
          </form>
        ) : (
          <LoginForm next={next ?? "/"} />
        )}
      </div>
    </main>
  );
}
