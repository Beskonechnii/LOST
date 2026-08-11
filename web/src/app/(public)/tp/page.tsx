import Link from "next/link";
import { listPlayers } from "@/lib/roster-data";
import { teamAccent } from "@/lib/profiles";
import { roleLabel } from "@/lib/roles";
import { isAdmin } from "@/lib/admin-session";
import { SectionHeader } from "@/app/_components/ui";
import { PlayerAvatar } from "../roster/_components/avatar";

export const dynamic = "force-dynamic";

export const metadata = { title: "TP" };

// Медали тройки лидеров — только визуальный акцент, порядок задаёт tp.
const MEDAL = ["🥇", "🥈", "🥉"];

// Публичный зачёт TP: очки MVP за сезон, оператор проставляет их вручную (/admin/tp).
// Игроки с нулём в таблицу не идут — она про тех, кто уже что-то набрал.
export default async function TpPage() {
  const players = await listPlayers();
  const authed = await isAdmin();
  const ranked = players.filter((p) => p.tp > 0).sort((a, b) => b.tp - a.tp);

  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader
        eyebrow="Сезонный зачёт"
        title="TP"
        aside={<span>Очки MVP за сезон LOST S2</span>}
      />

      {ranked.length === 0 ? (
        <div className="rounded-card bg-surface p-8 text-center text-sm font-bold text-muted cushion-field">
          Пока ни у кого нет TP.
          {authed && (
            <>
              {" "}
              Проставить можно в{" "}
              <Link href="/admin/tp" className="text-[var(--purple)] hover:underline">
                админке
              </Link>
              .
            </>
          )}
        </div>
      ) : (
        <ol className="space-y-2">
          {ranked.map((p, i) => {
            const accent = p.main ? teamAccent(p.main.team) : "#a855f7";
            return (
              <li key={p.id}>
                <Link
                  href={`/roster/players/${p.id}`}
                  className="flex items-center gap-4 rounded-card bg-surface px-4 py-3 cushion-row transition-transform hover:-translate-y-px hover:cushion-row-hover"
                >
                  {/* Место: медаль для тройки, номер для остальных — одинаковой ширины, чтобы ники встали в столбец */}
                  <span className="w-9 shrink-0 text-center text-lg font-black tabular-nums text-ink-muted">
                    {MEDAL[i] ?? i + 1}
                  </span>
                  <PlayerAvatar photo={p.photo} nickname={p.nickname} color={accent} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-black text-ink">{p.nickname}</div>
                    <div className="truncate text-xs font-bold text-muted">
                      {p.main
                        ? [p.main.team.name, roleLabel(p.main.role)].filter(Boolean).join(" · ")
                        : "без команды"}
                    </div>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="text-xl font-black tabular-nums text-[var(--purple)]">{p.tp}</span>
                    <span className="ml-1 text-xs font-bold text-muted">TP</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
