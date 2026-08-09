import { listTeams } from "@/lib/roster-data";
import { localHeroes } from "@/lib/dota-constants";
import { heroImg } from "@/lib/assets";
import { teamAccent } from "@/lib/profiles";
import { FearlessBoard, type HeroRef, type TeamRef } from "./_components/fearless-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fearless draft" };

// Fearless-драфт: борд оператора для драфта без повторов героев по серии. За паролем (группа admin).
// Данные читаются на сервере (команды ростера + справочник героев), сама механика — на клиенте
// (src/lib/fearless.ts). Персистентности пока нет: борд эфемерный, ведётся в одно окно на эфире.

export default async function FearlessDraftPage() {
  const teams = await listTeams();
  const teamRefs: TeamRef[] = teams.map((t) => ({ id: t.id, name: t.name, color: teamAccent(t), logo: t.logo }));

  // Герои из вендоренного справочника: id для драфта, slug для иконки, атрибут для фильтра.
  const heroes: HeroRef[] = localHeroes()
    .map((h) => {
      const slug = h.name.replace(/^npc_dota_hero_/, "");
      return { id: h.id, name: h.localized_name, slug, img: heroImg(slug), attr: h.primary_attr };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="mx-auto w-full max-w-[100rem] flex-1 px-4 py-8 md:px-6">
      <FearlessBoard teams={teamRefs} heroes={heroes} />
    </main>
  );
}
