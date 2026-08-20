"use client";

import { useActionState } from "react";
import { saveProfile, type SaveState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Форма правки своей анкеты. Только поля, которые игрок ведёт сам; MMR/роль/TP/фото сюда не входят —
// их правит оператор. Ник — с оговоркой про лимит «раз в сезон» (проверку делает server-action).

export type ProfileValues = {
  nickname: string;
  realName: string;
  city: string;
  country: string;
  birthday: string; // yyyy-mm-dd для <input type=date>
  telegram: string;
  profileLink: string;
  achievements: string;
};

const box = {
  error: "rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300",
  done: "rounded-md border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300",
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

export function ProfileForm({ values }: { values: ProfileValues }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveProfile, null);

  return (
    <form action={action} className="space-y-4">
      <Field label="Ник в лиге" hint="Отображаемое имя. Менять можно раз в сезон.">
        <Input name="nickname" defaultValue={values.nickname} required />
      </Field>

      <Field label="Имя">
        <Input name="realName" defaultValue={values.realName} placeholder="Как вас зовут" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Город">
          <Input name="city" defaultValue={values.city} />
        </Field>
        <Field label="Страна">
          <Input name="country" defaultValue={values.country} />
        </Field>
      </div>

      <Field label="Дата рождения">
        <Input name="birthday" type="date" defaultValue={values.birthday} />
      </Field>

      <Field label="Telegram" hint="Можно с @ или ссылкой — приведём к хендлу.">
        <Input name="telegram" defaultValue={values.telegram} placeholder="@nickname" />
      </Field>

      <Field label="Ссылка на профиль" hint="Dotabuff, Stratz или Steam — из неё определим ваш account_id, ссылки на витрине появятся сами.">
        <Input name="profileLink" defaultValue={values.profileLink} placeholder="https://www.dotabuff.com/players/…" />
      </Field>

      <Field label="Достижения" hint="Свободный список — одна строка на достижение.">
        <textarea
          name="achievements"
          defaultValue={values.achievements}
          rows={4}
          className="flex w-full rounded-md border border-hairline bg-surface-1 px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </Field>

      <div className="rounded-md border border-hairline bg-surface-2/40 px-3 py-2 text-xs text-ink-subtle">
        MMR, роль в составе, TP, номер и фото ведёт оператор — этих полей здесь нет.
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Сохраняю…" : "Сохранить анкету"}
      </Button>

      {state?.error && <p className={box.error}>{state.error}</p>}
      {state?.ok && <p className={box.done}>Анкета сохранена.</p>}
    </form>
  );
}
