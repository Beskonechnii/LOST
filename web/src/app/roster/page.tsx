import { redirect } from "next/navigation";

// Корень раздела — сразу команды: игроки открываются из состава или из своей вкладки.
export default function RosterIndex() {
  redirect("/roster/teams");
}
