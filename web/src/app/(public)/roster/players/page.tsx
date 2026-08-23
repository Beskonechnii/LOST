import { notFound, redirect } from "next/navigation";
import { currentTournament } from "@/lib/tournaments";

// Пара к /roster/teams: список игроков живёт внутри турнира.
export default async function PlayersRedirect() {
  const current = await currentTournament();
  if (!current) notFound();
  redirect(`/tournaments/${current.slug}/roster/players`);
}
