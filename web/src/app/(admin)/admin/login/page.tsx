import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminConfigured, verifyToken } from "@/lib/auth";
import { LoginForm } from "./form";
import { logout } from "./actions";
import { Button } from "@/components/pouf/Button";

export const dynamic = "force-dynamic";

// Вход в админку. Публичная страница (см. needsAdmin) — иначе входить было бы некуда.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const authed = verifyToken((await cookies()).get(ADMIN_COOKIE)?.value);

  return (
    <main className="flex-1 p-4 font-pouf md:p-8">
      <div className="mx-auto max-w-sm">
        <p className="text-[13px] font-extrabold uppercase tracking-[2px] text-muted">Служебная часть</p>
        <h1 className="mt-1.5 text-[28px] font-black tracking-[-0.5px] text-ink">Админка LOST</h1>
        <p className="mt-1.5 mb-5 text-sm font-bold text-muted">
          Пароль закрывает всё, что пишет: правку ростера, студию и запись через API. Публичная таблица,
          ростер и разбор матча открыты без него.
        </p>

        {!adminConfigured() ? (
          <p className="rounded-control bg-warn px-3 py-2 text-sm font-bold text-[var(--on-accent)]">
            <code>ADMIN_PASSWORD</code> не задан в <code>web/.env</code> — вход невозможен, админка закрыта.
          </p>
        ) : authed ? (
          <form action={logout} className="space-y-3">
            <p className="rounded-control bg-mint px-3 py-2 text-sm font-bold text-[var(--on-accent)]">
              Вход выполнен.
            </p>
            <Button type="submit" variant="quiet">
              Выйти
            </Button>
          </form>
        ) : (
          <LoginForm next={next ?? "/"} />
        )}
      </div>
    </main>
  );
}
