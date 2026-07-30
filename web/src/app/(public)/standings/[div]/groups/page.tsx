import Link from "next/link";
import { notFound } from "next/navigation";
import { getGroupStage } from "@/lib/group-stage";
import { divisionBySlug } from "@/lib/divisions";
import { SectionHeader } from "@/app/_components/ui";
import { GroupStage } from "../../_components/group-stage";

export const dynamic = "force-dynamic";

export default async function GroupsPage({ params }: { params: Promise<{ div: string }> }) {
  const { div } = await params;
  const division = divisionBySlug(div);
  if (!division) notFound();

  const tables = await getGroupStage(division.name);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`${division.label} · групповая стадия`}
        title="Групповая стадия"
        aside={
          <>
            Правка встречи сразу двигает{" "}
            <Link href={`/standings/${division.slug}`} className="text-accent-bright hover:underline">
              таблицу лиги
            </Link>
          </>
        }
      />

      {tables.length === 0 ? (
        <p className="text-ink-muted">
          Данных нет. Залить:{" "}
          <code className="text-ink-muted">
            npx tsx scripts/import-group-stage.ts --sheet &lt;id&gt; --div {division.slug.replace("d", "")}
          </code>
        </p>
      ) : (
        <GroupStage tables={tables} />
      )}
    </div>
  );
}
