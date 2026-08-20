"use client";

import { useActionState } from "react";
import { approve, reject, type ReviewState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Решение по одной заявке. Две формы рядом, а не одна с двумя кнопками: у отказа причина
// обязательна, и браузерная проверка `required` не должна мешать одобрению.

const errorBox = "rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300";

export function ReviewForms({
  accountId,
  mmr,
}: {
  accountId: number;
  /** Заявленный MMR для поля оператора; undefined — ветка «я уже в ростере», где поля нет вовсе:
   *  профиль с его MMR уже заведён, и апрув его не трогает. (null — «анкета есть, MMR не указал».) */
  mmr?: number | null;
}) {
  const [okState, approveAction, approving] = useActionState<ReviewState, FormData>(approve, null);
  const [noState, rejectAction, rejecting] = useActionState<ReviewState, FormData>(reject, null);
  const busy = approving || rejecting;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <form action={approveAction} className="flex items-end gap-2">
          <input type="hidden" name="accountId" value={accountId} />
          {mmr !== undefined && (
            <div className="w-28 space-y-1">
              <label className="block text-xs text-ink-subtle">MMR в лигу</label>
              <Input name="mmr" inputMode="numeric" defaultValue={mmr == null ? "" : String(mmr)} />
            </div>
          )}
          <Button type="submit" size="sm" disabled={busy}>
            {approving ? "Одобряю…" : "Одобрить"}
          </Button>
        </form>

        <form action={rejectAction} className="flex flex-1 items-end gap-2">
          <input type="hidden" name="accountId" value={accountId} />
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label className="block text-xs text-ink-subtle">Причина возврата</label>
            <Input name="reason" required placeholder="Чего не хватает в анкете" />
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={busy}>
            {rejecting ? "Возвращаю…" : "Вернуть"}
          </Button>
        </form>
      </div>

      {(okState?.error || noState?.error) && <p className={errorBox}>{okState?.error ?? noState?.error}</p>}
    </div>
  );
}
