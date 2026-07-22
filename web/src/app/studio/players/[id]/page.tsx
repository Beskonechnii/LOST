import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayer, listTeams } from "@/lib/studio-data";
import { playerLinks } from "@/lib/profiles";
import { PlayerEditor } from "../../_components/editors";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [player, teams] = await Promise.all([getPlayer(Number(id)), listTeams()]);
  if (!player) notFound();

  const links = playerLinks(player);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/studio/players" className="text-sm text-neutral-500 hover:text-neutral-300">
          ← Игроки
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{player.nickname}</h1>
        <p className="text-xs text-neutral-600">slug: {player.slug}</p>
      </div>

      <PlayerEditor
        id={player.id}
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        initial={{
          nickname: player.nickname,
          realName: player.realName ?? "",
          accountId: player.accountId ?? "",
          position: player.position ? String(player.position) : "",
          isCaptain: player.isCaptain,
          telegram: player.telegram ?? "",
          photo: player.photo,
          teamId: player.teamId ? String(player.teamId) : "",
        }}
      />

      <section className="text-sm">
        <h2 className="mb-2 text-xs uppercase tracking-widest text-neutral-500">Профили</h2>
        {links.dotabuff ? (
          <div className="flex gap-4">
            {links.dotabuff && (
              <a href={links.dotabuff} target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">
                Dotabuff
              </a>
            )}
            {links.stratz && (
              <a href={links.stratz} target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">
                Stratz
              </a>
            )}
            {links.steam && (
              <a href={links.steam} target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">
                Steam
              </a>
            )}
          </div>
        ) : (
          <p className="text-neutral-500">Заполните account_id — ссылки соберутся сами.</p>
        )}
      </section>
    </div>
  );
}
