import { listPlayers } from "@/lib/roster-data";
import { roleLabel } from "@/lib/roles";
import { playerGaps, teamAccent } from "@/lib/profiles";
import { isAdmin } from "@/lib/admin-session";
import { CreateForm } from "@/app/_components/roster-editors";
import { SectionHeader } from "@/app/_components/ui";
import { PlayerMiniCard } from "../_components/player-card";

export const dynamic = "force-dynamic";

// Витрина игроков — публичная. Форма создания и статистика пробелов в анкетах видны
// только вошедшему: это операторская диагностика полноты данных, а не факт о лиге.
export default async function PlayersPage() {
  const players = await listPlayers();
  const authed = await isAdmin();
  // Без account_id игрок не подтягивается из OpenDota; остальные дыры анкеты — из CRM, их добиваем руками
  const noId = players.filter((p) => !p.accountId).length;
  const incomplete = players.filter((p) => playerGaps(p).length > 0).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Ростер лиги"
        title="Игроки"
        aside={
          <>
            {players.length} игроков
            {authed && noId > 0 && <span className="ml-2 text-amber-400">{noId} без account_id</span>}
            {authed && incomplete > 0 && <span className="ml-2 text-ink-subtle">{incomplete} с неполной анкетой</span>}
          </>
        }
      />

      {authed && (
        <CreateForm
          url="/api/roster/players"
          submitLabel="Добавить игрока"
          fields={[
            { key: "nickname", label: "Ник", placeholder: "CHIPOLLINO" },
            { key: "accountId", label: "account_id", placeholder: "123456789" },
          ]}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((p) => {
          // Пробелы анкеты подсвечиваем только оператору — это состояние наших данных,
          // а не факт об игроке. Посетитель видит ровную сетку карточек.
          const gaps = authed ? playerGaps(p) : [];
          const flagId = authed && !p.accountId;
          return (
            <PlayerMiniCard
              key={p.id}
              id={p.id}
              nickname={p.nickname}
              photo={p.photo}
              accent={p.main ? teamAccent(p.main.team) : null}
              role={roleLabel(p.main?.role)}
              mmr={p.mmr}
              isCaptain={p.main?.isCaptain ?? false}
              size={56}
              flagged={flagId}
              subtitle={
                <div className="mt-1 space-y-0.5">
                  <div className="truncate text-xs text-ink-subtle">{p.main?.team.name ?? "без команды"}</div>
                  {/* стоит ещё где-то (обычно заменой) — показываем, чтобы не выглядело потерянным */}
                  {p.spots.length > 1 && (
                    <div className="truncate text-xs text-ink-subtle">
                      ещё в {p.spots.slice(1).map((s) => s.team.name).join(", ")}
                    </div>
                  )}
                  {/* чек-лист анкеты: что осталось добить из CRM (пусто для посетителя) */}
                  {gaps.length > 0 && (
                    <div className={`truncate text-xs ${p.accountId ? "text-ink-subtle" : "text-amber-400"}`}>
                      нет: {gaps.join(", ")}
                    </div>
                  )}
                </div>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
