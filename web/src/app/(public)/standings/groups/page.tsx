import Link from "next/link";
import { getGroupStage } from "@/lib/group-stage";
import { GroupStage } from "../_components/group-stage";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const tables = await getGroupStage("Division 1");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Групповая стадия</h1>
        <p className="text-xs text-neutral-500">
          Правка встречи сразу двигает{" "}
          <Link href="/standings" className="text-violet-400 hover:underline">
            таблицу лиги
          </Link>
        </p>
      </div>

      {tables.length === 0 ? (
        <p className="text-neutral-400">
          Данных нет. Залить: <code className="text-neutral-300">npx tsx scripts/import-group-stage.ts --sheet &lt;id&gt; --div 1</code>
        </p>
      ) : (
        <GroupStage tables={tables} />
      )}
    </div>
  );
}
