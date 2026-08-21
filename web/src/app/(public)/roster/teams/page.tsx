import { listTeamRosters } from "@/lib/roster-data";
import { can } from "@/lib/account";
import { CreateForm } from "@/app/_components/roster-editors";
import { SectionHeader } from "@/app/_components/ui";
import { TeamCards } from "../_components/team-cards";
import { DivTabs, parseDiv, divName } from "../_components/div-tabs";

export const dynamic = "force-dynamic";

// Страница публичная — витрина команд лиги. Форма создания и счётчик пробелов в данных
// показываются только вошедшему оператору: посетителю они не нужны, а сама запись всё равно
// закрыта в needsAdmin() на уровне API.
export default async function TeamsPage({ searchParams }: { searchParams: Promise<{ div?: string }> }) {
  const div = parseDiv((await searchParams).div);
  const authed = await can("roster.edit");

  // Дивизион команды — её Team.group; «Все» показывает весь список.
  const name = divName(div);
  const teams = (await listTeamRosters()).filter((t) => !name || t.group === name);
  const noId = teams.reduce((sum, t) => sum + t.noAccountIdCount, 0);

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow="Ростер лиги"
        title="Команды"
        aside={
          <>
            {teams.length} команд
            {authed && noId > 0 && <span className="ml-2 text-amber-400">{noId} без account_id</span>}
          </>
        }
      />

      <DivTabs current={div} base="/roster/teams" />

      {authed && (
        <CreateForm
          url="/api/roster/teams"
          submitLabel="Добавить команду"
          fields={[
            { key: "name", label: "Название", placeholder: "MOLOKO" },
            { key: "tag", label: "Тег", placeholder: "MLK" },
            { key: "group", label: "Дивизион", placeholder: "Division 1" },
          ]}
        />
      )}

      <TeamCards teams={teams} />
    </div>
  );
}
