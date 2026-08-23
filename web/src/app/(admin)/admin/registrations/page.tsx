import Link from "next/link";
import { pendingRegistrations, accountApplication, type PendingRegistration } from "@/lib/account";
import { ApplicationSummary } from "@/app/_components/application-summary";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { ReviewForms } from "./review-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Регистрации" };

// Очередь регистраций: сюда попадает всё, что человек отправил из кабинета (ACCOUNTS-PLAN.md §4).
// Две ветки воронки в одном списке, помечены типом: «новая анкета» (Player ещё нет — он заведётся
// при одобрении) и «привязка» (профиль в ростере есть, апрув только связывает его с аккаунтом).
//
// Право accounts.approve: proxy пускает в /admin любого админа, поэтому конкретный раздел закрываем
// здесь. Не право — не ошибка, а плашка: админ, который ведёт архив серий, просто сюда не ходит.

const dateTime = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function RegistrationsPage() {
  const denied = await denyUnlessPermission("accounts.approve", "Регистрации");
  if (denied) return denied;

  const queue = await pendingRegistrations();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300/80">Служебная часть</p>
      <h1 className="mt-1.5 text-xl font-bold tracking-tight">
        Регистрации{queue.length > 0 && <span className="ml-2 text-base font-normal text-ink-subtle">{queue.length}</span>}
      </h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Регистрация — это заявка. Одобрение заводит профиль в ростере (или привязывает существующий) и
        открывает человеку кабинет. Возврат с причиной — анкету можно поправить и прислать снова.
      </p>

      {queue.length === 0 ? (
        <p className="mt-6 rounded-md border border-hairline bg-surface-1 px-3 py-6 text-center text-sm text-ink-subtle">
          Новых заявок нет.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {queue.map((account) => (
            <li key={account.id} className="rounded-lg border border-hairline bg-surface-1 p-4">
              <Card account={account} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Card({ account }: { account: PendingRegistration }) {
  const application = accountApplication(account);
  const sent = account.submittedAt ? dateTime.format(account.submittedAt) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={`rounded-md border px-2 py-0.5 text-xs ${
            account.claim
              ? "border-sky-900 bg-sky-950/40 text-sky-300"
              : "border-emerald-900 bg-emerald-950/40 text-emerald-300"
          }`}
        >
          {account.claim ? "привязка к профилю" : "новая анкета"}
        </span>
        <span className="min-w-0 truncate text-sm text-ink-muted">{account.email}</span>
        {account.name && <span className="truncate text-sm text-ink-subtle">· {account.name}</span>}
        {sent && <span className="ml-auto shrink-0 text-xs text-ink-subtle">отправлено {sent}</span>}
      </div>

      {account.claim ? (
        <div className="rounded-md border border-hairline bg-surface-2/40 px-3 py-2 text-sm">
          Заявляет, что он —{" "}
          {/* адрес карточки игрока — числовой id, не slug (см. /roster/players/[id]) */}
          <Link href={`/roster/players/${account.claim.id}`} className="font-semibold text-accent-bright hover:underline">
            {account.claim.nickname}
          </Link>
          . Сверьте по профилю: анкеты у этой ветки нет — все данные уже в ростере.
        </div>
      ) : application ? (
        <div className="rounded-md border border-hairline bg-surface-2/40 px-3 py-2">
          <ApplicationSummary application={application} />
        </div>
      ) : (
        <p className="rounded-md border border-rose-900 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
          Заявка пустая: ни анкеты, ни выбранного профиля. Верните её с причиной.
        </p>
      )}

      <ReviewForms accountId={account.id} mmr={account.claim ? undefined : (application?.mmr ?? null)} />
    </div>
  );
}
