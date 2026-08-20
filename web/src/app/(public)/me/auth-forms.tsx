"use client";

import { useActionState, useState } from "react";
import { register, login, resend, forgot, type AuthState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Формы входа по email + паролю: три режима — «Войти», «Регистрация», «Забыли пароль». Рядом с
// Google-кнопкой (её рисует страница). Каждый режим — своя server-action через useActionState.

type Mode = "login" | "register" | "forgot";

const box = {
  error: "rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300",
  done: "rounded-md border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300",
};

export function AuthForms() {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div className="space-y-4">
      {/* Переключатель Войти / Регистрация — как сегмент-контрол */}
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-hairline bg-surface-2/60 p-1">
        <Seg active={mode === "login"} onClick={() => setMode("login")}>Войти</Seg>
        <Seg active={mode === "register"} onClick={() => setMode("register")}>Регистрация</Seg>
      </div>

      {mode === "login" && <LoginForm onForgot={() => setMode("forgot")} />}
      {mode === "register" && <RegisterForm />}
      {mode === "forgot" && <ForgotForm onBack={() => setMode("login")} />}
    </div>
  );
}

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-accent text-white" : "text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function LoginForm({ onForgot }: { onForgot: () => void }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, null);
  return (
    <form action={action} className="space-y-3">
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" placeholder="you@gmail.com" required />
      </Field>
      <Field label="Пароль">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Вхожу…" : "Войти"}
      </Button>
      <button type="button" onClick={onForgot} className="block w-full text-center text-xs text-ink-subtle hover:text-ink">
        Забыли пароль?
      </button>
      {state?.error && <p className={box.error}>{state.error}</p>}
      {state?.unverified && <ResendLine />}
      {state?.done && <p className={box.done}>{state.done}</p>}
    </form>
  );
}

/** Кнопка «выслать подтверждение снова» — появляется, когда вход упал на неподтверждённой почте. */
function ResendLine() {
  const [state, action, pending] = useActionState<AuthState, FormData>(resend, null);
  return (
    <form action={action} className="space-y-2">
      <Input name="email" type="email" placeholder="Ваш email для повторного письма" required />
      <Button type="submit" variant="outline" disabled={pending} className="w-full">
        {pending ? "Отправляю…" : "Выслать подтверждение снова"}
      </Button>
      {state?.done && <p className={box.done}>{state.done}</p>}
    </form>
  );
}

function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(register, null);
  if (state?.done) return <p className={box.done}>{state.done}</p>;
  return (
    <form action={action} className="space-y-3">
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" placeholder="you@gmail.com" required />
      </Field>
      <Field label="Имя (необязательно)">
        <Input name="name" autoComplete="name" placeholder="Как к вам обращаться" />
      </Field>
      <Field label="Пароль">
        <Input name="password" type="password" autoComplete="new-password" placeholder="Минимум 8 символов" required />
      </Field>
      <Field label="Повторите пароль">
        <Input name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Создаю…" : "Зарегистрироваться"}
      </Button>
      <p className="text-center text-xs text-ink-subtle">
        Регистрируясь, вы соглашаетесь с правилами лиги.
      </p>
      {state?.error && <p className={box.error}>{state.error}</p>}
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(forgot, null);
  return (
    <form action={action} className="space-y-3">
      <button type="button" onClick={onBack} className="text-xs text-ink-subtle hover:text-ink">
        ← назад ко входу
      </button>
      <p className="text-sm text-ink-muted">
        Введите почту — пришлём ссылку, чтобы задать новый пароль. Так же можно задать пароль впервые,
        если раньше входили только через Google.
      </p>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" placeholder="you@gmail.com" required />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Отправляю…" : "Прислать ссылку"}
      </Button>
      {state?.done ? <p className={box.done}>{state.done}</p> : state?.error && <p className={box.error}>{state.error}</p>}
    </form>
  );
}
