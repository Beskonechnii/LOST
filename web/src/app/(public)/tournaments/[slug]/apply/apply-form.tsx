"use client";

import { useActionState } from "react";
import { submitApplication, type ApplyState } from "./actions";
import { ROLES } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Форма заявки капитана. Восемь строк состава фиксированно, а не «добавить игрока»: пятёрка,
// тренер и пара замен закрывают почти любой состав, а динамический список на server-action
// потребовал бы клиентского состояния ради одного экрана в год.
//
// Игрок из ростера подставляется подсказкой (`datalist` по никам лиги) — отдельного поиска с сетью
// не нужно: ников пара сотен, они уезжают в форму разом. Новичка, которого в базе нет, капитан
// просто пишет руками: `Player` ему заведёт апрув, а не эта форма (то же правило, что в анкете
// кабинета). Замечания показываются здесь же, до отправки, кнопкой «Проверить состав».

const ROWS = [0, 1, 2, 3, 4, 5, 6, 7];
const errorBox = "rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300";

export type PlayerRow = {
  nickname: string;
  realName: string | null;
  role: string | null;
  mmr: number | null;
  link: string | null;
  telegram: string | null;
  isCaptain: boolean;
};

export function ApplyForm({
  tournamentId,
  tournamentSlug,
  divisions,
  knownNicknames,
  initial,
}: {
  tournamentId: number;
  tournamentSlug: string;
  divisions: { id: number; name: string }[];
  /** Ники ростера — подсказки в поле ника: «этот игрок в лиге уже есть». */
  knownNicknames: string[];
  /** Уже поданная заявка: повторная подача открывает её на правку, а не плодит строку в очереди. */
  initial?: { name: string; tag: string | null; divisionId: number | null; players: PlayerRow[] } | null;
}) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(submitApplication, null);

  // После ответа сервера форма показывает то, что капитан ввёл, а не пустые поля: поля
  // неконтролируемые (defaultValue), поэтому перемонтируем форму по метке ответа — тогда новые
  // значения подхватываются. Без этого «Проверить состав» стирал бы весь набранный состав.
  const filled = state?.values ?? initial ?? null;
  const rows = filled?.players ?? [];
  const captainAt = rows.findIndex((p) => p.isCaptain);

  return (
    <form key={state?.stamp ?? "initial"} action={action} className="space-y-4">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <input type="hidden" name="tournamentSlug" value={tournamentSlug} />

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className="text-xs text-ink-muted">Название команды</span>
          <Input name="name" required placeholder="Например: ГУЗЛИКИ" defaultValue={filled?.name ?? ""} className="mt-1" />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Тег</span>
          <Input name="tag" placeholder="ГУЗЛИ" defaultValue={filled?.tag ?? ""} className="mt-1" />
        </label>
        {divisions.length > 0 && (
          <label className="block">
            <span className="text-xs text-ink-muted">Дивизион</span>
            <select
              name="divisionId"
              className="mt-1 h-9 w-full rounded-md border border-hairline bg-surface-2 px-2 text-sm"
              defaultValue={filled?.divisionId ? String(filled.divisionId) : ""}
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
          без неё человека не опознать в архиве матчей. Кружком отметьте капитана: капитан — тот, кто
          отмечен в составе, а не обязательно тот, кто подаёт заявку. Игроки лиги подсказываются по
          нику; новичка, которого в базе ещё нет, просто впишите — профиль заведётся при одобрении.
        </p>

        {/* Подсказки ников: список общий на все строки состава. */}
        <datalist id="roster-nicknames">
          {knownNicknames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        {ROWS.map((i) => (
          <div key={i} className="grid gap-2 rounded-md border border-hairline bg-surface-1 p-2 sm:grid-cols-12">
            <div className="flex items-center gap-2 sm:col-span-3">
              <input
                type="radio"
                name="captain"
                value={i}
                aria-label="капитан"
                defaultChecked={captainAt >= 0 ? captainAt === i : i === 0}
              />
              <Input
                name={`nickname-${i}`}
                list="roster-nicknames"
                placeholder={i < 5 ? `Ник (поз. ${i + 1})` : "Ник"}
                defaultValue={rows[i]?.nickname ?? ""}
              />
            </div>
            <Input name={`realName-${i}`} placeholder="Имя" defaultValue={rows[i]?.realName ?? ""} className="sm:col-span-2" />
            <select
              name={`role-${i}`}
              defaultValue={rows[i]?.role ?? (i < 5 ? ROLES[i]?.key ?? "" : "")}
              className="h-9 rounded-md border border-hairline bg-surface-2 px-2 text-sm sm:col-span-2"
            >
              <option value="">роль</option>
              {ROLES.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
            <Input name={`mmr-${i}`} placeholder="MMR" inputMode="numeric" defaultValue={rows[i]?.mmr ?? ""} className="sm:col-span-1" />
            <Input name={`link-${i}`} placeholder="Ссылка на профиль" defaultValue={rows[i]?.link ?? ""} className="sm:col-span-3" />
            <Input name={`telegram-${i}`} placeholder="@tg" defaultValue={rows[i]?.telegram ?? ""} className="sm:col-span-1" />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Две кнопки на одну форму: intent решает, проверить состав или отправить. Так проверка
            идёт по тем же данным, что уйдут в очередь, и не требует второго экрана. */}
        <Button type="submit" name="intent" value="submit" disabled={pending}>
          {pending ? "Отправляю…" : initial ? "Сохранить заявку" : "Отправить заявку"}
        </Button>
        <Button type="submit" name="intent" value="check" variant="outline" disabled={pending}>
          Проверить состав
        </Button>
        <span className="text-xs text-ink-subtle">
          MMR — заявленный: итоговую цифру в лиге ставит организатор.
        </span>
      </div>

      {state?.error && <p className={errorBox}>{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-400">{state.ok}</p>}

      {/* Замечания: красное закрывает отправку, жёлтое — повод перепроверить, серое — просто факт. */}
      {state?.problems && state.problems.length > 0 && (
        <ul className="space-y-1">
          {state.problems.map((p, i) => (
            <li
              key={i}
              className={`rounded-md border px-3 py-1.5 text-xs ${
                p.level === "block"
                  ? "border-rose-900 bg-rose-950/40 text-rose-300"
                  : p.level === "warn"
                    ? "border-amber-900 bg-amber-950/40 text-amber-300"
                    : "border-hairline bg-surface-2 text-ink-subtle"
              }`}
            >
              {p.text}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
