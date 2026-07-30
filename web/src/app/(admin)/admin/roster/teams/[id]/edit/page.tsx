import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeam } from "@/lib/roster-data";
import { TeamEditor } from "@/app/_components/roster-editors";

export const dynamic = "force-dynamic";

// Как и у игрока: страница команды — витрина, формы живут отдельно.
export default async function TeamEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await getTeam(Number(id));
  if (!team) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-subtle">
        <Link href="/roster/teams" className="hover:text-ink-muted">
          Команды
        </Link>
        <span className="text-ink-subtle">/</span>
        <Link href={`/roster/teams/${team.id}`} className="hover:text-ink-muted">
          {team.name}
        </Link>
        <span className="text-ink-subtle">/</span>
        <span className="text-ink-muted">правка</span>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{team.name}</h1>
          <p className="text-xs text-ink-subtle">slug: {team.slug} — ключ импорта составов и подбора файлов</p>
        </div>
        <Link href={`/roster/teams/${team.id}`} className="text-sm text-ink-muted hover:text-accent-bright">
          ← к команде
        </Link>
      </div>

      <TeamEditor
        id={team.id}
        initial={{
          name: team.name,
          tag: team.tag ?? "",
          group: team.group ?? "",
          color: team.color ?? "",
          logo: team.logo,
          wordmark: team.wordmark,
          photo: team.photo,
        }}
      />

      <p className="text-sm text-ink-subtle">
        Состав правится на карточках игроков: роль и капитанство принадлежат месту в составе.
      </p>
    </div>
  );
}
