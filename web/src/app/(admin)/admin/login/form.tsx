"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { Button } from "@/components/pouf/Button";
import { inputClasses } from "@/components/pouf/Input";

// Форма входа. Ошибка приходит из серверного экшена через useActionState —
// отдельного состояния и fetch-обвязки для одного поля не нужно.
// Поле — нативный input (форма отправляется server action по name), но в скине pouf.
export function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(login, null);

  return (
    <form action={action} className="space-y-3 font-pouf">
      <input type="hidden" name="next" value={next} />
      <input
        name="password"
        type="password"
        autoFocus
        autoComplete="current-password"
        placeholder="Пароль"
        className={inputClasses()}
      />
      <Button type="submit" loading={pending} block>
        Войти
      </Button>
      {error && (
        <p className="rounded-control bg-orange px-3 py-2 text-sm font-bold text-[var(--on-accent)]">{error}</p>
      )}
    </form>
  );
}
