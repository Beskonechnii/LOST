import { listTeamRosters } from "@/lib/roster-data";
import { CreateForm } from "../editors";
import { TeamCards } from "../_components/team-cards";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const teams = await listTeamRosters();
  const noId = teams.reduce((sum, t) => sum + t.noAccountIdCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Команды</h1>
        <span className="text-sm text-neutral-500">
          {teams.length} шт.
          {noId > 0 && <span className="ml-2 text-amber-400">{noId} игрок(ов) без account_id</span>}
        </span>
      </div>

      <CreateForm
        url="/api/roster/teams"
        submitLabel="Добавить команду"
        fields={[
          { key: "name", label: "Название", placeholder: "MOLOKO" },
          { key: "tag", label: "Тег", placeholder: "MLK" },
          { key: "group", label: "Дивизион", placeholder: "Division 1" },
        ]}
      />

      <TeamCards teams={teams} />
    </div>
  );
}
