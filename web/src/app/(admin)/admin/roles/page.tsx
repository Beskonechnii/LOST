import Link from "next/link";
import { currentRole, listAccounts, ownerEmail } from "@/lib/account";
import { Button } from "@/components/ui/button";
import { makeAdmin, makePlayer } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Роли и доступ" };

// Панель владельца: кто есть кто и с какой ролью. Владелец (по OWNER_EMAIL) раздаёт admin/player.
// В /admin proxy пускает любого admin/owner — поэтому саму панель закрываем от не-владельцев здесь.

const ROLE_LABEL: Record<string, string> = { owner: "Владелец", admin: "Админ", player: "Игрок" };
const ROLE_STYLE: Record<string, string> = {
  owner: "border-fuchsia-800 bg-fuchsia-950/40 text-fuchsia-300",
  admin: "border-emerald-900 bg-emerald-950/40 text-emerald-300",
  player: "border-hairline bg-surface-2 text-ink-muted",
};

export default async function RolesPage() {
  if ((await currentRole()) !== "owner") {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 md:px-6">
        <h1 className="text-xl font-bold tracking-tight">Роли и доступ</h1>
        <p className="mt-4 rounded-md border border-amber-900 bg-amber-950/40 px-3 py-2 text-sm text-amber-300">
          Раздел только для владельца лиги. Если это вы — войдите под своей почтой (OWNER_EMAIL) через
          «Кабинет».
        </p>
      </main>
    );
  }

  const accounts = await listAccounts();
  const owner = ownerEmail();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 md:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fuchsia-300/80">Владелец лиги</p>
      <h1 className="mt-1.5 text-xl font-bold tracking-tight">Роли и доступ</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Админы принимают заявки и правят лигу. Владелец назначается по <code>OWNER_EMAIL</code>
        {owner ? <> (<span className="text-ink">{owner}</span>)</> : null} и роль здесь не меняет.
      </p>

      {accounts.length === 0 ? (
        <p className="mt-6 rounded-md border border-hairline bg-surface-1 px-3 py-6 text-center text-sm text-ink-subtle">
          Пока никто не входил через Google.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-lg border border-hairline bg-surface-1 px-4 py-3">
              <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs ${ROLE_STYLE[a.effectiveRole]}`}>
                {ROLE_LABEL[a.effectiveRole]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <span className="text-ink-muted">{a.email}</span>
                  {a.name && <span className="text-ink-subtle"> · {a.name}</span>}
                </p>
                {a.player && (
                  <p className="mt-0.5 truncate text-xs text-ink-subtle">
                    профиль:{" "}
                    <Link href={`/roster/players/${a.player.slug}`} className="text-accent-bright hover:underline">
                      {a.player.nickname}
                    </Link>
                  </p>
                )}
              </div>
              {a.effectiveRole === "owner" ? (
                <span className="shrink-0 text-xs text-ink-subtle">по почте</span>
              ) : a.effectiveRole === "admin" ? (
                <form action={makePlayer}>
                  <input type="hidden" name="accountId" value={a.id} />
                  <Button type="submit" size="sm" variant="outline">Снять админа</Button>
                </form>
              ) : (
                <form action={makeAdmin}>
                  <input type="hidden" name="accountId" value={a.id} />
                  <Button type="submit" size="sm">Сделать админом</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-ink-subtle">
        Новая роль вступает в силу при следующем входе игрока (роль вшита в его сессию).
      </p>
    </main>
  );
}
