"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Форма входа. Ошибка приходит из серверного экшена через useActionState —
// отдельного состояния и fetch-обвязки для одного поля не нужно.
export function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(login, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <Input name="password" type="password" autoFocus autoComplete="current-password" placeholder="Пароль" />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Проверяю…" : "Войти"}
      </Button>
      {error && (
        <p className="rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">{error}</p>
      )}
    </form>
  );
}
