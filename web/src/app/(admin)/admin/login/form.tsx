"use client";

import { useActionState } from "react";
import { login } from "./actions";

// Форма входа. Ошибка приходит из серверного экшена через useActionState —
// отдельного состояния и fetch-обвязки для одного поля не нужно.
export function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(login, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <input
        name="password"
        type="password"
        autoFocus
        autoComplete="current-password"
        placeholder="Пароль"
        className="w-full rounded-lg border border-hairline bg-surface-1 px-3 py-2 text-sm outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/25"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast hover:bg-accent-bright disabled:opacity-50"
      >
        {pending ? "Проверяю…" : "Войти"}
      </button>
      {error && (
        <p className="rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">{error}</p>
      )}
    </form>
  );
}
