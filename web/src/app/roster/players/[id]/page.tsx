import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayer, listTeams } from "@/lib/roster-data";
import { playerLinks } from "@/lib/profiles";
import { roleOrder } from "@/lib/roles";
import { PlayerEditor, SpotsEditor } from "../../editors";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [player, teams] = await Promise.all([getPlayer(Number(id)), listTeams()]);
  if (!player) notFound();

  const links = playerLinks(player);
  // в крошках показываем команду, где он действующий, иначе первую по порядку ролей
  const spots = [...player.spots].sort((a, b) => roleOrder(a.role) - roleOrder(b.role));
  const main = spots[0] ?? null;

  return (
    <div className="space-y-8">
      <div>
        {/* хлебные крошки: чаще всего сюда приходят из состава команды, туда и возвращаемся */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
          <Link href="/roster/players" className="hover:text-neutral-300">
            Игроки
          </Link>
          {main && (
            <>
              <span className="text-neutral-700">/</span>
              <Link href={`/roster/teams/${main.team.id}`} className="hover:text-neutral-300">
                {main.team.name}
              </Link>
            </>
          )}
          <span className="text-neutral-700">/</span>
          <span className="text-neutral-400">{player.nickname}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{player.nickname}</h1>
        <p className="text-xs text-neutral-600">slug: {player.slug}</p>
      </div>

      <PlayerEditor
        id={player.id}
        initial={{
          nickname: player.nickname,
          realName: player.realName ?? "",
          accountId: player.accountId ?? "",
          mmr: player.mmr ? String(player.mmr) : "",
          telegram: player.telegram ?? "",
          photo: player.photo,
        }}
      />

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-widest text-neutral-500">Составы</h2>
        <SpotsEditor
          playerId={player.id}
          teams={teams.map((t) => ({ id: t.id, name: t.name }))}
          spots={spots.map((s) => ({
            id: s.id,
            teamId: s.teamId,
            teamName: s.team.name,
            role: s.role ?? "",
            isCaptain: s.isCaptain,
          }))}
        />
      </section>

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
