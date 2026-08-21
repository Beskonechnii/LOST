"use client";

import { useActionState } from "react";
import { submitApplication, type ApplyState } from "./actions";
import { ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Форма заявки капитана. Восемь строк состава фиксированно, а не «добавить игрока»: пятёрка,
// тренер и пара замен закрывают почти любой состав, а динамический список на server-action
// потребовал бы клиентского состояния ради одного экрана в год.

const ROWS = [0, 1, 2, 3, 4, 5, 6, 7];
const errorBox = "rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300";

export function ApplyForm({
  tournamentId,
  tournamentSlug,
  divisions,
}: {
  tournamentId: number;
  tournamentSlug: string;
  divisions: { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(submitApplication, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <input type="hidden" name="tournamentSlug" value={tournamentSlug} />

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className="text-xs text-ink-muted">Название команды</span>
          <Input name="name" required placeholder="Например: ГУЗЛИКИ" className="mt-1" />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Тег</span>
          <Input name="tag" placeholder="ГУЗЛИ" className="mt-1" />
        </label>
        {divisions.length > 0 && (
          <label className="block">
            <span className="text-xs text-ink-muted">Дивизион</span>
            <select
              name="divisionId"
              className="mt-1 h-9 w-full rounded-md border border-hairline bg-surface-2 px-2 text-sm"
              defaultValue=""
            >
              <option value="">— на усмотрение организаторов —</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-ink-muted">
          Состав: минимум пять игроков. Ссылка на Dotabuff, Stratz или Steam обязательна для каждого —
          без неё человека не опознать в архиве матчей. Кружком отметьте капитана.
        </p>
        {ROWS.map((i) => (
          <div key={i} className="grid gap-2 rounded-md border border-hairline bg-surface-1 p-2 sm:grid-cols-12">
            <div className="flex items-center gap-2 sm:col-span-3">
              <input type="radio" name="captain" value={i} aria-label="капитан" defaultChecked={i === 0} />
              <Input name={`nickname-${i}`} placeholder={i < 5 ? `Ник (поз. ${i + 1})` : "Ник"} />
            </div>
            <Input name={`realName-${i}`} placeholder="Имя" className="sm:col-span-2" />
            <select
              name={`role-${i}`}
              defaultValue={i < 5 ? ROLES[i]?.key ?? "" : ""}
              className="h-9 rounded-md border border-hairline bg-surface-2 px-2 text-sm sm:col-span-2"
            >
              <option value="">роль</option>
              {ROLES.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
            <Input name={`mmr-${i}`} placeholder="MMR" inputMode="numeric" className="sm:col-span-1" />
            <Input name={`link-${i}`} placeholder="Ссылка на профиль" className="sm:col-span-3" />
            <Input name={`telegram-${i}`} placeholder="@tg" className="sm:col-span-1" />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Отправляю…" : "Отправить заявку"}</Button>
        <span className="text-xs text-ink-subtle">
          MMR — заявленный: итоговую цифру в лиге ставит организатор.
        </span>
      </div>
      {state?.error && <p className={errorBox}>{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-400">{state.ok}</p>}
    </form>
  );
}
