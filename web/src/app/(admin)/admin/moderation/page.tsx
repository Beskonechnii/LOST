import Link from "next/link";
import { pendingClaims, pendingRegistrations, accountApplication, type PendingRegistration } from "@/lib/account";
import { ApplicationSummary } from "@/app/_components/application-summary";
import { Button } from "@/components/ui/button";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { approveLink, rejectLink } from "./actions";
import { ReviewForms } from "./review-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Модерация" };

// Один раздел на все решения «пускать в лигу»: анкеты новых игроков и привязки к профилю ростера.
// Раньше это были два адреса (/admin/registrations и /admin/claims) с одним и тем же правом —
// оператор проверял то одну страницу, то другую и терял заявки. Теперь вкладки внутри, обе с
// числом новых; старые адреса редиректят сюда (next.config.ts).
//
// Имя раздела нарочно шире, чем «регистрации»: следующим сюда переедут заявки команд на турнир.
//
// Право accounts.approve: proxy пускает в /admin любого админа, поэтому конкретный раздел закрываем
// здесь. Не право — не ошибка, а плашка: админ, который ведёт архив серий, просто сюда не ходит.

const TABS = [
  { key: "profiles", label: "Регистрация личного профиля" },
  { key: "links", label: "Привязка к профилю" },
] as const;
type TabKey = (typeof TABS)[number]["key"];
const isTab = (v: unknown): v is TabKey => TABS.some((t) => t.key === v);

const dateTime = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const denied = await denyUnlessPermission("accounts.approve", "Модерация");
  if (denied) return denied;

  const raw = (await searchParams).tab;
  const tab: TabKey = isTab(raw) ? raw : "profiles";
  const [queue, claims] = await Promise.all([pendingRegistrations(), pendingClaims()]);
  const counts: Record<TabKey, number> = { profiles: queue.length, links: claims.length };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300/80">Служебная часть</p>
      <h1 className="mt-1.5 text-xl font-bold tracking-tight">Модерация</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Всё, что человек отправил из кабинета. Одобрение заводит профиль в ростере (или привязывает
        существующий) и открывает кабинет; возврат с причиной — анкету можно поправить и прислать снова.
      </p>

      {/* Разрез живёт в query, как и везде на сайте: ссылку на нужную вкладку можно кинуть в чат. */}
      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "profiles" ? "/admin/moderation" : `/admin/moderation?tab=${t.key}`}
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
              tab === t.key
                ? "border-accent bg-surface-2 text-ink"
                : "border-hairline bg-surface-1 text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
            {/* Индикатор новых: цветом и числом, чтобы вторая вкладка не терялась из виду. */}
            {counts[t.key] > 0 && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                {counts[t.key]}
              </span>
            )}
          </Link>
        ))}
      </div>

      {tab === "profiles" ? <Registrations queue={queue} /> : <Claims claims={claims} />}
    </main>
  );
}

/** Очередь анкет: обе ветки воронки (новая анкета и привязка) — те, что человек отправил из кабинета. */
function Registrations({ queue }: { queue: PendingRegistration[] }) {
  if (queue.length === 0) {
    return (
      <p className="mt-6 rounded-md border border-hairline bg-surface-1 px-3 py-6 text-center text-sm text-ink-subtle">
        Новых заявок нет.
      </p>
    );
  }
  return (
    <ul className="mt-6 space-y-3">
      {queue.map((account) => (
        <li key={account.id} className="rounded-lg border border-hairline bg-surface-1 p-4">
          <Card account={account} />
        </li>
      ))}
    </ul>
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

/**
 * Привязка к профилю: игрок вошёл и заявил, что он — такой-то в ростере, оператор сверяет.
 * Заявки, отправленные из кабинета, лежат в первой вкладке и сюда не дублируются (`pendingClaims`).
 */
function Claims({ claims }: { claims: Awaited<ReturnType<typeof pendingClaims>> }) {
  if (claims.length === 0) {
    return (
      <p className="mt-6 rounded-md border border-hairline bg-surface-1 px-3 py-6 text-center text-sm text-ink-subtle">
        Открытых заявок нет.
      </p>
    );
  }
  return (
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
              {/* карточка игрока живёт по числовому id, не по слагу (см. /roster/players/[id]) */}
              <Link href={`/roster/players/${c.claim!.id}`} className="font-semibold text-accent-bright hover:underline">
                {c.claim!.nickname}
              </Link>
            </p>
          </div>
          <form action={approveLink}>
            <input type="hidden" name="accountId" value={c.id} />
            <Button type="submit" size="sm">Подтвердить</Button>
          </form>
          <form action={rejectLink}>
            <input type="hidden" name="accountId" value={c.id} />
            <Button type="submit" size="sm" variant="outline">Отклонить</Button>
          </form>
        </li>
      ))}
    </ul>
  );
}
