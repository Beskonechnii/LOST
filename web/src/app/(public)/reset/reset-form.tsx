"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestReset, setNewPassword, type ResetState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Форма сброса пароля. Есть токен (перешли из письма) → задаём новый пароль; нет → просим email,
// чтобы прислать ссылку. Компонент клиентский ради useActionState и живой валидации совпадения.

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

export function ResetForm({ token }: { token: string | null }) {
  return token ? <SetForm token={token} /> : <RequestForm />;
}

function RequestForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(requestReset, null);
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-ink-muted">
        Введите почту — пришлём ссылку, чтобы задать новый пароль.
      </p>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" placeholder="you@gmail.com" required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Отправляю…" : "Прислать ссылку"}
      </Button>
      {state?.done ? <p className={box.done}>{state.done}</p> : state?.error && <p className={box.error}>{state.error}</p>}
      <Link href="/me" className="block text-center text-xs text-ink-subtle hover:text-ink">
        ← вернуться ко входу
      </Link>
    </form>
  );
}

function SetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(setNewPassword, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-ink-muted">Задайте новый пароль для входа.</p>
      <Field label="Новый пароль">
        <Input name="password" type="password" autoComplete="new-password" placeholder="Минимум 8 символов" required />
      </Field>
      <Field label="Повторите пароль">
        <Input name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Сохраняю…" : "Сохранить пароль"}
      </Button>
      {state?.error && <p className={box.error}>{state.error}</p>}
    </form>
  );
}
