import { notFound, redirect } from "next/navigation";
import { currentTournament } from "@/lib/tournaments";

// Ссылки на /roster/teams раздавались в чат — ведём их на ростер текущего турнира.
export default async function TeamsRedirect() {
  const current = await currentTournament();
  if (!current) notFound();
  redirect(`/tournaments/${current.slug}/roster/teams`);
}
