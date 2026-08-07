import { listPlayers } from "@/lib/roster-data";
import { SITE_MAX_W } from "@/app/_components/ui";
import { TpAdmin } from "./_components/tp-admin";

export const dynamic = "force-dynamic";

export const metadata = { title: "TP" };

// Служебная часть: проставить игрокам сезонные TP (очки MVP). Оператор правит их вручную раз в
// неделю. Пишет через PATCH /api/roster/players/[id] — тот же путь, что и правка анкеты игрока.
export default async function TpAdminPage() {
  const players = await listPlayers();

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <TpAdmin players={players.map((p) => ({ id: p.id, nickname: p.nickname, tp: p.tp }))} />
    </main>
  );
}
