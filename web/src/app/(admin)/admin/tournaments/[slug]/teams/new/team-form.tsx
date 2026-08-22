"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createTeam, enrichRows, parseRoster, type CreateState, type EnrichRowsState, type ParsedState } from "./actions";
import { emptyPlayer, type PlayerDraft } from "@/lib/roster-import";
import { ROLES } from "@/lib/roles";
import { rankLabel } from "@/lib/dota-rank";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Problem } from "@/lib/team-application";

// Форма ручной регистрации команды. Два способа заполнить состав — построчно и вставкой текста
// (капитаны присылают состав сообщением чаще, чем таблицей), плюс кнопка «подтянуть данные».
// Состав живёт в состоянии формы и уходит в экшен одним JSON — как черновик импорта.

const box = "rounded-lg border border-hairline bg-surface-1 p-4";
const errorBox = "rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300";

const TONE: Record<Problem["level"], string> = {
  block: "border-rose-900 bg-rose-950/40 text-rose-300",
  warn: "border-amber-900 bg-amber-950/40 text-amber-300",
  info: "border-hairline bg-surface-2 text-ink-subtle",
};

/** Пустой состав: пятёрка по позициям, тренер и замена — то, что заводят чаще всего. */
const startRows = (): PlayerDraft[] => [
  ...ROLES.slice(0, 5).map((r, i) => ({ ...emptyPlayer(""), role: ROLES[i].key, isCaptain: i === 0 })),
  { ...emptyPlayer(""), role: "coach" as const },
];

export function TeamForm({
  tournamentId,
  tournamentSlug,
  divisions,
}: {
  tournamentId: number;
  tournamentSlug: string;
  divisions: { id: number; name: string }[];
}) {
  const [rows, setRows] = useState<PlayerDraft[]>(startRows);
  const [parsed, parseAction, parsing] = useActionState<ParsedState, FormData>(parseRoster, null);
  const [enriched, enrichAction, enriching] = useActionState<EnrichRowsState, FormData>(enrichRows, null);
  const [created, createAction, creating] = useActionState<CreateState, FormData>(createTeam, null);

  // Разбор и обогащение возвращают строки — подхватываем их, не теряя того, что оператор уже правил
  // руками: показываем ровно то, что уйдёт в запись.
  const shown = enriched?.players ?? parsed?.players ?? rows;
  const patch = (i: number, field: keyof PlayerDraft, value: string | boolean | null) =>
    setRows(shown.map((p, j) => (i === j ? { ...p, [field]: value } : p)));

  // Никто не отмечен (так приходит разобранный текст) — капитаном считаем первого, как и сервер.
  const captain = shown.some((p) => p.isCaptain) ? shown.findIndex((p) => p.isCaptain) : 0;

  return (
    <div className="space-y-4">
      <form action={parseAction} className={`${box} space-y-2`}>
        <label htmlFor="pasted" className="text-xs text-ink-muted">
          Вставить состав текстом (по строке на игрока: ник, роль, MMR, ссылка)
        </label>
        <Textarea
          id="pasted"
          name="pasted"
          rows={4}
          placeholder={'Ник; 1; 5200; https://www.dotabuff.com/players/123456\nВторой; 2; 5100; https://stratz.com/players/234567'}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" variant="outline" disabled={parsing}>
            {parsing ? "Разбираю…" : "Разобрать в строки"}
          </Button>
          <span className="text-[11px] text-ink-subtle">Разбор заменит строки состава ниже.</span>
        </div>
        {parsed?.error && <p className={errorBox}>{parsed.error}</p>}
      </form>

      <form action={createAction} className={`${box} space-y-4`}>
        <input type="hidden" name="tournamentId" value={tournamentId} />
        <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
        <input type="hidden" name="players" value={JSON.stringify(shown)} />

        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block sm:col-span-2">
            <span className="text-xs text-ink-muted">Название команды</span>
            <Input name="name" required placeholder="ГУЗЛИКИ" className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs text-ink-muted">Тег</span>
            <Input name="tag" placeholder="ГУЗЛИ" className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs text-ink-muted">Слаг</span>
            <Input name="slug" placeholder="из названия" className="mt-1" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs text-ink-muted">Дивизион</span>
            <select
              name="divisionId"
              defaultValue={divisions[0]?.id ?? ""}
              className="mt-1 h-9 w-full rounded-md border border-hairline bg-surface-2 px-2 text-sm"
            >
              {divisions.length === 0 && <option value="">в турнире нет дивизионов</option>}
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-2">
          {shown.map((p, i) => (
            <div key={i} className="grid gap-2 rounded-md border border-hairline bg-surface-2 p-2 sm:grid-cols-12">
              <div className="flex items-center gap-2 sm:col-span-3">
                <input
                  type="radio"
                  name="captain-row"
                  checked={captain === i}
                  onChange={() => setRows(shown.map((x, j) => ({ ...x, isCaptain: i === j })))}
                  aria-label="капитан"
                />
                <Input
                  value={p.nickname}
                  onChange={(e) => patch(i, "nickname", e.target.value)}
                  placeholder={i < 5 ? `Ник (поз. ${i + 1})` : "Ник"}
                />
              </div>
              <Input
                className="sm:col-span-2"
                value={p.realName ?? ""}
                onChange={(e) => patch(i, "realName", e.target.value || null)}
                placeholder="Имя"
              />
              <select
                className="h-9 rounded-md border border-hairline bg-surface-1 px-2 text-sm sm:col-span-2"
                value={p.role ?? ""}
                onChange={(e) => patch(i, "role", e.target.value || null)}
              >
                <option value="">роль</option>
                {ROLES.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
              <Input
                className="sm:col-span-1"
                inputMode="numeric"
                value={p.mmr == null ? "" : String(p.mmr)}
                onChange={(e) => patch(i, "mmr", e.target.value ? String(Number(e.target.value) || "") : null)}
                placeholder="MMR"
              />
              <Input
                className="sm:col-span-4"
                value={p.dotabuffUrl ?? p.stratzUrl ?? p.steamUrl ?? ""}
                onChange={(e) => patch(i, "dotabuffUrl", e.target.value || null)}
                placeholder="Ссылка на профиль"
              />
              {(p.accountId || rankLabel(p.rank)) && (
                <p className="text-[11px] text-ink-subtle sm:col-span-12">
                  {[p.accountId && `id ${p.accountId}`, rankLabel(p.rank), p.dotaName && `в доте «${p.dotaName}»`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setRows([...shown, emptyPlayer("")])}>
              + строка
            </Button>
            <Button type="submit" size="sm" variant="outline" formAction={enrichAction} disabled={enriching}>
              {enriching ? "Тяну из Steam и OpenDota…" : "Подтянуть данные"}
            </Button>
          </div>
          {enriched?.error && <p className={errorBox}>{enriched.error}</p>}
          {enriched?.notes && enriched.notes.length > 0 && (
            <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-hairline bg-surface-2 p-2">
              {enriched.notes.map((n, i) => (
                <li key={i} className={`text-[11px] ${n.level === "warn" ? "text-amber-300" : "text-ink-subtle"}`}>
                  {n.nickname}: {n.text}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={creating || divisions.length === 0}>
            {creating ? "Завожу…" : "Завести команду"}
          </Button>
          <span className="text-[11px] text-ink-subtle">
            Команда, игроки и состав появятся в ростере сразу. MMR — заявленный.
          </span>
        </div>

        {created?.error && <p className={errorBox}>{created.error}</p>}
        {created?.problems && created.problems.length > 0 && (
          <ul className="space-y-1">
            {created.problems.map((p, i) => (
              <li key={i} className={`rounded-md border px-2 py-1 text-xs ${TONE[p.level]}`}>{p.text}</li>
            ))}
          </ul>
        )}
        {created?.applicationId && (
          <p className="text-sm text-amber-300">
            Есть замечания, которые нельзя обойти — заявка ждёт в{" "}
            <Link href={`/admin/tournaments/${tournamentSlug}/registrations`} className="underline">
              очереди
            </Link>
            : поправьте данные и одобрите там.
          </p>
        )}
        {created?.teamId && (
          <p className="flex flex-wrap items-center gap-3 text-sm text-emerald-400">
            <span>
              Команда заведена —{" "}
              <Link href={`/roster/teams/${created.teamId}`} className="underline">
                открыть карточку
              </Link>
              .
            </span>
            {/* Форма остаётся заполненной прошлой командой; для следующей чистим её перезагрузкой —
                состояние экшена иначе не сбросить. */}
            <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()}>
              Завести ещё одну
            </Button>
          </p>
        )}
      </form>
    </div>
  );
}
