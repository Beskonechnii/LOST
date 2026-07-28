import { redirect } from "next/navigation";
import { DIVISIONS } from "@/lib/divisions";

// Голый /standings дивизион не выбирает — уводим на первый (LOST D1). Дальше всё живёт под [div].
export default function StandingsIndex() {
  redirect(`/standings/${DIVISIONS[0].slug}`);
}
