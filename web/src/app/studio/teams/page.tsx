import Link from "next/link";
import { listTeams } from "@/lib/studio-data";
import { CreateForm } from "../_components/editors";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const teams = await listTeams();

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Команды</h1>
        <span className="text-sm text-neutral-500">{teams.length} шт.</span>
      </div>

      <CreateForm
        url="/api/studio/teams"
        submitLabel="Добавить команду"
        fields={[
          { key: "name", label: "Название", placeholder: "MOLOKO" },
          { key: "tag", label: "Тег", placeholder: "MLK" },
          { key: "group", label: "Дивизион", placeholder: "Division 1" },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((t) => (
          <Link
            key={t.id}
            href={`/studio/teams/${t.id}`}
            className="flex items-center gap-3 rounded border border-neutral-800 bg-neutral-900/40 p-3 hover:border-violet-600"
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded bg-neutral-900">
              {t.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.logo} alt="" className="h-full w-full object-contain" />
              ) : (
                <span className="text-[10px] text-neutral-600">нет лого</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium">{t.name}</div>
              <div className="truncate text-xs text-neutral-500">
                {[t.tag, t.group, `${t.playersCount} игрок(ов)`].filter(Boolean).join(" · ")}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
