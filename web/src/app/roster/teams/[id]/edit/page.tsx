import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeam } from "@/lib/roster-data";
import { TeamEditor } from "../../../editors";

export const dynamic = "force-dynamic";

// Как и у игрока: страница команды — витрина, формы живут отдельно.
export default async function TeamEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await getTeam(Number(id));
  if (!team) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
        <Link href="/roster/teams" className="hover:text-neutral-300">
          Команды
        </Link>
        <span className="text-neutral-700">/</span>
        <Link href={`/roster/teams/${team.id}`} className="hover:text-neutral-300">
          {team.name}
        </Link>
        <span className="text-neutral-700">/</span>
        <span className="text-neutral-400">правка</span>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{team.name}</h1>
          <p className="text-xs text-neutral-600">slug: {team.slug} — ключ импорта составов и подбора файлов</p>
        </div>
        <Link href={`/roster/teams/${team.id}`} className="text-sm text-neutral-400 hover:text-violet-300">
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

      <p className="text-sm text-neutral-500">
        Состав правится на карточках игроков: роль и капитанство принадлежат месту в составе.
      </p>
    </div>
  );
}
