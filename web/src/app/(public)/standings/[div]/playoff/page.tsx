import Link from "next/link";
import { notFound } from "next/navigation";
import { divisionBySlug } from "@/lib/divisions";
import { QUALIFICATION } from "@/lib/qualification";
import { resolveBracket } from "@/lib/playoff";
import { Eyebrow, SectionHeader } from "@/app/_components/ui";
import { BracketView } from "./_components/bracket";

export const dynamic = "force-dynamic";

// Сетка плей-офф из живых данных: посев — из групп, участники поздних слотов вычисляются из
// исходов ранних (см. src/lib/playoff.ts). Счёт и продвижение берутся из архива серий, руками
// здесь ничего не задаётся: страница — отражение того, что заведено в /admin/series.

export default async function PlayoffPage({ params }: { params: Promise<{ div: string }> }) {
  const { div } = await params;
  const division = divisionBySlug(div);
  if (!division) notFound();

  const bracket = await resolveBracket(division.name);
  if (!bracket.seeded) {
    return <p className="text-ink-muted">Групповая стадия ещё не залита — посев брать неоткуда.</p>;
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={`${division.label} · плей-офф`}
        title="Плей-офф"
        aside={<span className="text-ink-subtle">Сетка и счёт — из архива серий</span>}
      />

      {/* Сетка живёт в общей колонке SITE_MAX_W, как и весь сайт: её край совпадает с шапкой,
          подменю и заголовком. AutoScale подгоняет сетку под ширину колонки (натуральная ширина
          ≈ ширине колонки, поэтому масштаб близок к 1:1). */}
      <BracketView slots={bracket.slots} />

      {/* Не прошедшие из групп — вылет ещё до сетки. */}
      {bracket.out.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${QUALIFICATION.out.marker}`} />
            <Eyebrow className="text-ink-muted">Вылет из групп</Eyebrow>
          </div>
          <div className="flex flex-wrap gap-2">
            {bracket.out.map((t) => (
              <Link
                key={t.teamId}
                href={`/roster/teams/${t.teamId}`}
                className="rounded-lg border border-hairline bg-surface-1 px-2.5 py-1.5 text-xs text-ink-muted transition hover:border-rose-600/60 hover:text-rose-400"
              >
                {t.name}
                <span className="ml-1 text-ink-subtle">
                  {t.group}
                  {t.place}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
