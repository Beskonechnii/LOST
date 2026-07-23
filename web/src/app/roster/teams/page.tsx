import Link from "next/link";
import { listTeams } from "@/lib/roster-data";
import { CreateForm } from "../editors";

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
        url="/api/roster/teams"
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
            href={`/roster/teams/${t.id}`}
            className={`flex items-center gap-3 rounded border bg-neutral-900/40 p-3 hover:border-violet-600 ${
              t.noAccountIdCount > 0 ? "border-amber-500/60" : "border-neutral-800"
            }`}
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
              {t.mmrAverage !== null && (
                <div className="truncate text-xs text-neutral-400">
                  ср. MMR <span className="font-medium text-neutral-200">{t.mmrAverage.toLocaleString("ru")}</span>
                  <span className="text-neutral-600"> · Σ {t.mmrTotal.toLocaleString("ru")}</span>
                </div>
              )}
              {/* Временно: пока добиваем account_id, видно с одного взгляда, где ещё дыры */}
              {t.noAccountIdCount > 0 && (
                <div className="text-xs text-amber-400">{t.noAccountIdCount} без account_id</div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
