import Link from "next/link";
import { notFound } from "next/navigation";
import { tournamentBySlug } from "@/lib/tournaments";
import { denyUnlessPermission } from "../../../../../_components/permission-gate";
import { TeamForm } from "./team-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Новая команда" };

// Ручная регистрация команды оператором: то же, что импорт файла, но на одну команду и без файла.
// Пишется тем же путём (заявка → апрув), поэтому проверки составов работают и здесь.

export default async function NewTeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const denied = await denyUnlessPermission("tournaments.edit", "Новая команда");
  if (denied) return denied;

  const { slug } = await params;
  const tournament = await tournamentBySlug(slug);
  if (!tournament) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 md:px-6">
      <Link href={`/admin/tournaments/${tournament.slug}`} className="text-xs text-ink-subtle hover:text-ink">
        ← {tournament.name}
      </Link>
      <h1 className="mt-2 text-xl font-bold tracking-tight">Завести команду</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Для одной команды — быстрее файла: вставьте состав сообщением капитана или заполните строки
        руками, подтяните данные по ссылкам и заведите. Игроки, которые уже есть в ростере,
        привяжутся к существующим профилям, а не заведутся вторыми.
      </p>

      <div className="mt-6">
        <TeamForm
          tournamentId={tournament.id}
          tournamentSlug={tournament.slug}
          divisions={tournament.divisions.map((d) => ({ id: d.id, name: d.name }))}
        />
      </div>
    </main>
  );
}
