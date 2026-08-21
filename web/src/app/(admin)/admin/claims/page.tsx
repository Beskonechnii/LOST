import Link from "next/link";
import { pendingClaims } from "@/lib/account";
import { Button } from "@/components/ui/button";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { approve, reject } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Заявки на привязку" };

// Подтверждение привязки аккаунтов к профилям ростера. Игрок вошёл через Google и заявил, что он —
// такой-то в ростере; оператор сверяет и подтверждает. Новые игроки заводят профиль без заявки,
// сюда они не попадают.

export default async function ClaimsPage() {
  // Привязка — то же решение «пускать в лигу», что и очередь регистраций: одно право на обе очереди.
  const denied = await denyUnlessPermission("accounts.approve", "Заявки на привязку");
  if (denied) return denied;

  const claims = await pendingClaims();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 md:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300/80">Служебная часть</p>
      <h1 className="mt-1.5 text-xl font-bold tracking-tight">Заявки на привязку</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Игрок вошёл через Google и заявил, что он — такой-то в ростере. Подтвердите, если это он.
      </p>

      {claims.length === 0 ? (
        <p className="mt-6 rounded-md border border-hairline bg-surface-1 px-3 py-6 text-center text-sm text-ink-subtle">
          Открытых заявок нет.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {claims.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-lg border border-hairline bg-surface-1 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <span className="text-ink-muted">{c.email}</span>
                  {c.name && <span className="text-ink-subtle"> · {c.name}</span>}
                </p>
                <p className="mt-0.5 text-sm">
                  заявляет:{" "}
                  <Link href={`/roster/players/${c.claim!.slug}`} className="font-semibold text-accent-bright hover:underline">
                    {c.claim!.nickname}
                  </Link>
                </p>
              </div>
              <form action={approve}>
                <input type="hidden" name="accountId" value={c.id} />
                <Button type="submit" size="sm">Подтвердить</Button>
              </form>
              <form action={reject}>
                <input type="hidden" name="accountId" value={c.id} />
                <Button type="submit" size="sm" variant="outline">Отклонить</Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
