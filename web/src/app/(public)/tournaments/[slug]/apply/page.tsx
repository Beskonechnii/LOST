import Link from "next/link";
import { notFound } from "next/navigation";
import { registrationOpen, tournamentBySlug } from "@/lib/tournaments";
import { currentAccount } from "@/lib/account";
import { myApplications, parseDraft } from "@/lib/team-application";
import { roleLabel } from "@/lib/roles";
import { SITE_MAX_W } from "../../../../_components/ui";
import { ApplyForm } from "./apply-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Заявка команды" };

// Заявка капитана на турнир. Попадает в ту же очередь `TeamApplication`, что и импорт файла, —
// разница только в `source`. Приём открыт, пока турнир в статусе «Приём заявок».

const date = new Intl.DateTimeFormat("ru", { day: "numeric", month: "long" });

export default async function ApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  if (!tournament || tournament.status === "draft") notFound();

  const me = await currentAccount();
  const mine = me ? await myApplications(me.id, tournament.id) : [];
  const open = registrationOpen(tournament);

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <Link href={`/tournaments/${tournament.slug}`} className="text-xs text-ink-subtle hover:text-ink">
        ← {tournament.name}
      </Link>
      <h1 className="mt-2 text-2xl font-black tracking-tight">Заявка команды</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {tournament.name}
        {tournament.regCloseAt && ` · заявки до ${date.format(tournament.regCloseAt)}`}
      </p>

      {mine.length > 0 && (
        <ul className="mt-6 space-y-2">
          {mine.map((a) => {
            const draft = parseDraft(a.payload);
            return (
              <li key={a.id} className="rounded-lg border border-hairline bg-surface-1 p-4 text-sm">
                <p>
                  <span className="font-semibold">{draft?.name ?? "заявка"}</span>{" "}
                  <span className="text-ink-subtle">
                    ·{" "}
                    {a.status === "pending" ? "на рассмотрении"
                      : a.status === "approved" ? "принята"
                      : "возвращена"}
                    {a.division && ` · ${a.division.name}`}
                  </span>
                </p>
                {draft && (
                  <p className="mt-1 text-xs text-ink-subtle">
                    {draft.players.map((p) => `${p.nickname} (${roleLabel(p.role) ?? "роль не указана"})`).join(", ")}
                  </p>
                )}
                {a.notes && <p className="mt-1 text-xs text-amber-300">Причина возврата: {a.notes}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {!me ? (
        <p className="mt-6 rounded-md border border-hairline bg-surface-1 px-3 py-4 text-sm text-ink-muted">
          Заявку подаёт капитан из своего аккаунта.{" "}
          <Link href="/me" className="text-accent-bright hover:underline">Войти в кабинет</Link>
        </p>
      ) : me.status !== "active" ? (
        <p className="mt-6 rounded-md border border-amber-900 bg-amber-950/40 px-3 py-4 text-sm text-amber-300">
          Заявку на команду можно подать после того, как одобрят вашу личную анкету.{" "}
          <Link href="/me" className="underline">Открыть кабинет</Link>
        </p>
      ) : !open ? (
        <p className="mt-6 rounded-md border border-hairline bg-surface-1 px-3 py-4 text-sm text-ink-muted">
          Приём заявок на этот турнир сейчас закрыт.
        </p>
      ) : (
        <div className="mt-6">
          <ApplyForm
            tournamentId={tournament.id}
            tournamentSlug={tournament.slug}
            divisions={tournament.divisions.map((d) => ({ id: d.id, name: d.name }))}
          />
        </div>
      )}
    </main>
  );
}
