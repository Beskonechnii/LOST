import Link from "next/link";
import { notFound } from "next/navigation";
import { getQualified } from "@/lib/group-stage";
import { QUALIFICATION } from "@/lib/qualification";
import { divisionBySlug } from "@/lib/divisions";

export const dynamic = "force-dynamic";

// Набросок сетки: посев берём из групп по-настоящему, сами пары — заглушка под регламент,
// который ещё не зафиксирован. Счёт нигде не хранится, ничего не редактируется.

type Seed = { teamId: number; name: string; tag: string; group: string; place: number };

/** Плашка участника. Пусто — пара ещё не определена (ждёт победителя предыдущего раунда). */
function Slot({ seed, waiting }: { seed?: Seed; waiting?: string }) {
  if (!seed) {
    return (
      <div className="flex h-9 items-center rounded border border-dashed border-neutral-800 px-2 text-xs text-neutral-600">
        {waiting ?? "—"}
      </div>
    );
  }
  return (
    <Link
      href={`/roster/teams/${seed.teamId}`}
      className="flex h-9 items-center gap-2 rounded border border-neutral-800 bg-neutral-900/60 px-2 text-sm hover:border-violet-600"
    >
      <span className="w-10 shrink-0 text-[10px] font-medium text-neutral-500">{seed.tag}</span>
      <span className="truncate font-medium">{seed.name}</span>
      <span className="ml-auto shrink-0 text-[10px] text-neutral-600">
        {seed.group}
        {seed.place}
      </span>
    </Link>
  );
}

function Round({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-52 space-y-3">
      <h3 className="text-xs uppercase tracking-widest text-neutral-500">{title}</h3>
      {children}
    </div>
  );
}

function Pair({ a, b, waiting }: { a?: Seed; b?: Seed; waiting?: string }) {
  return (
    <div className="space-y-1 rounded-lg border border-neutral-800/60 bg-neutral-900/20 p-2">
      <Slot seed={a} waiting={waiting} />
      <Slot seed={b} waiting={waiting} />
    </div>
  );
}

export default async function PlayoffPage({ params }: { params: Promise<{ div: string }> }) {
  const { div } = await params;
  const division = divisionBySlug(div);
  if (!division) notFound();

  const { upper, lower, out } = await getQualified(division.name);

  if (upper.length === 0) {
    return <p className="text-neutral-400">Групповая стадия ещё не залита — посев брать неоткуда.</p>;
  }

  // Классический посев: первый играет с последним из тех, кто прошёл. Пары в верхней сетке —
  // 1×4 и 2×3 внутри своей половины, чтобы команды из одной группы не встретились в первом раунде.
  const a = upper.filter((t) => t.group === "A");
  const b = upper.filter((t) => t.group === "B");
  const ubPairs: [Seed | undefined, Seed | undefined][] = [
    [a[0], b[3]],
    [b[1], a[2]],
    [a[1], b[2]],
    [b[0], a[3]],
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Плей-офф</h1>
        <p className="text-xs text-amber-400">Черновик: посев из групп настоящий, пары — предположение под будущий регламент</p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-sm ${QUALIFICATION.upper.marker}`} />
          <h2 className="text-sm uppercase tracking-widest text-neutral-300">Верхняя сетка</h2>
          <span className="text-xs text-neutral-600">1–4 места групп</span>
        </div>
        {/* раунды — колонки, слева направо по ходу сетки; на узком экране прокручиваются вбок */}
        <div className="grid grid-cols-[repeat(4,minmax(13rem,1fr))] gap-4 overflow-x-auto pb-2">
          <Round title="Четвертьфинал">
            {ubPairs.map(([x, y], i) => (
              <Pair key={i} a={x} b={y} />
            ))}
          </Round>
          <Round title="Полуфинал">
            <Pair waiting="победитель ЧФ" />
            <Pair waiting="победитель ЧФ" />
          </Round>
          <Round title="Финал верхней">
            <Pair waiting="победитель ПФ" />
          </Round>
          <Round title="Гранд-финал">
            <Pair waiting="победитель сетки" />
          </Round>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-sm ${QUALIFICATION.lower.marker}`} />
          <h2 className="text-sm uppercase tracking-widest text-neutral-300">Нижняя сетка</h2>
          <span className="text-xs text-neutral-600">5–6 места групп + проигравшие сверху</span>
        </div>
        <div className="grid grid-cols-[repeat(3,minmax(13rem,1fr))] gap-4 overflow-x-auto pb-2">
          <Round title="Раунд 1">
            <Pair a={lower[0]} b={lower[3]} />
            <Pair a={lower[1]} b={lower[2]} />
          </Round>
          <Round title="Раунд 2">
            <Pair waiting="проигравший ЧФ" />
            <Pair waiting="проигравший ЧФ" />
          </Round>
          <Round title="Финал нижней">
            <Pair waiting="победитель Р2" />
          </Round>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-sm ${QUALIFICATION.out.marker}`} />
          <h2 className="text-sm uppercase tracking-widest text-neutral-300">Вылет</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {out.map((t) => (
            <Link
              key={t.teamId}
              href={`/roster/teams/${t.teamId}`}
              className="rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-500 hover:border-rose-600 hover:text-rose-400"
            >
              {t.name}
              <span className="ml-1 text-neutral-700">
                {t.group}
                {t.place}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
