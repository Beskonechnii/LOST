"use client";

import { useActionState, useState } from "react";
import { savePassword, deleteAccount, type SecState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Формы вкладки «Вход и защита»: смена/задание пароля и удаление аккаунта.

const box = {
  error: "rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300",
  done: "rounded-md border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** Смена пароля, а для входивших только через Google — задание пароля впервые (без «текущего»). */
export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState<SecState, FormData>(savePassword, null);
  return (
    <form action={action} className="space-y-3">
      {hasPassword && (
        <Field label="Текущий пароль">
          <Input name="current" type="password" autoComplete="current-password" required />
        </Field>
      )}
      <Field label="Новый пароль">
        <Input name="next" type="password" autoComplete="new-password" placeholder="Минимум 8 символов" required />
      </Field>
      <Field label="Повторите новый пароль">
        <Input name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Сохраняю…" : hasPassword ? "Сменить пароль" : "Задать пароль"}
      </Button>
      {state?.error && <p className={box.error}>{state.error}</p>}
      {state?.ok && <p className={box.done}>{state.ok}</p>}
    </form>
  );
}

/** Удаление аккаунта — за подтверждением галочкой, чтобы не снести вход случайно. */
export function DeleteAccount() {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <form action={deleteAccount} className="space-y-3">
      <label className="flex items-start gap-2 text-sm text-ink-muted">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-rose-500"
        />
        <span>Понимаю: вход к профилю оборвётся. Профиль игрока и статистика в лиге останутся.</span>
      </label>
      <Button
        type="submit"
        disabled={!confirmed}
        className="w-full bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50"
      >
        Удалить аккаунт
      </Button>
    </form>
  );
}
