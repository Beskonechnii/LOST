import { redirect } from "next/navigation";

// Голый /admin/tournaments/new — первый шаг мастера: номер шага всегда виден в адресе.
export default function NewTournamentIndex() {
  redirect("/admin/tournaments/new/describe");
}
