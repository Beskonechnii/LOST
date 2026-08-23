import { notFound, redirect } from "next/navigation";
import { currentTournament } from "@/lib/tournaments";

// Старый адрес ростера. Списки команд и игроков переехали внутрь турнира
// (/tournaments/<slug>/roster/...): состав сезонный, и общий список «все команды за всю историю»
// на витрине смысла не имеет. Карточки /roster/teams/<id> и /roster/players/<id> остались здесь —
// команда и игрок переживают турнир.
export default async function RosterIndex() {
  const current = await currentTournament();
  if (!current) notFound();
  redirect(`/tournaments/${current.slug}/roster/teams`);
}
