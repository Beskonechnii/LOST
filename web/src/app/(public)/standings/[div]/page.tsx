import Link from "next/link";
import { notFound } from "next/navigation";
import { getGroupStage } from "@/lib/group-stage";
import { QUALIFICATION } from "@/lib/qualification";
import { divisionBySlug } from "@/lib/divisions";
import { Chip, SectionHeader } from "@/app/_components/ui";
import { GroupStage } from "../_components/group-stage";

export const dynamic = "force-dynamic";

// Групповая стадия: таблица групп и сетка личных встреч на одной странице. Считается только по
// групповым сериям (stage="group") — плей-офф и разовые матчи сюда не попадают.
export default async function StandingsPage({ params }: { params: Promise<{ div: string }> }) {
  const { div } = await params;
  const division = divisionBySlug(div);
  if (!division) notFound();

  const tables = await getGroupStage(division.name);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`${division.label} · групповая стадия`}
        title="Групповая стадия"
        aside={<>Счёт и очки — из привязанных карт архива серий, автоматически</>}
      />

      {/* легенда зон: те же цвета, что и рейка слева от места. В D2 вылета из группы нет — чип не показываем */}
      <div className="flex flex-wrap gap-2">
        {(division.name === "Division 2" ? (["upper", "lower"] as const) : (["upper", "lower", "out"] as const)).map((k) => (
          <Chip key={k}>
            <span className={`h-2 w-2 rounded-full ${QUALIFICATION[k].marker}`} />
            {QUALIFICATION[k].label}
          </Chip>
        ))}
      </div>

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

      <Link href={`/standings/${division.slug}/playoff`} className="inline-block text-xs text-ink-subtle hover:text-accent-bright">
        Дальше — плей-офф с посевом из групп →
      </Link>
    </div>
  );
}
