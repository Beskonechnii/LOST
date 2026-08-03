"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UploadKind } from "@/lib/profiles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Мелкие клиентские кирпичики студии: поля, загрузка картинок, кнопка сохранения.
// Данные читают серверные страницы, пишут — эти компоненты через /api/studio/*.

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs uppercase tracking-widest text-ink-subtle">{children}</span>;
}

export function TextField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "number" | "date";
  hint?: string;
}) {
  return (
    <label className="block">
      <Label>{props.label}</Label>
      <Input
        type={props.type ?? "text"}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.hint && <span className="mt-1 block text-xs text-ink-subtle">{props.hint}</span>}
    </label>
  );
}

export function TextAreaField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <Label>{props.label}</Label>
      <Textarea
        className="resize-y leading-relaxed"
        rows={props.rows ?? 5}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

export function SelectField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  // Radix Select запрещает SelectItem с пустым value (пустая строка = «ничего не выбрано»).
  // Поэтому опцию-плейсхолдер (value: "") не рендерим пунктом, а показываем её label в триггере,
  // а пустое текущее значение отдаём как undefined — тогда Radix сам покажет плейсхолдер. API обёртки
  // не меняется: потребители по-прежнему передают {value, onChange, options} со строками.
  const placeholder = props.options.find((o) => o.value === "")?.label;
  const items = props.options.filter((o) => o.value !== "");
  return (
    <label className="block">
      <Label>{props.label}</Label>
      <Select value={props.value || undefined} onValueChange={props.onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

/** Слот картинки: показывает текущую, грузит новую в public/uploads, отдаёт путь наверх. */
export function ImageField(props: {
  label: string;
  kind: UploadKind;
  value: string | null;
  onChange: (path: string | null) => void;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.set("kind", props.kind);
    body.set("file", file);
    const res = await fetch("/api/roster/upload", { method: "POST", body });
    const json = (await res.json()) as { path?: string; error?: string };
    setBusy(false);
    if (!res.ok || !json.path) setError(json.error ?? "Не удалось загрузить");
    else props.onChange(json.path);
  }

  return (
    <div>
      <Label>{props.label}</Label>
      <div className="flex items-center gap-3">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-hairline bg-surface-1">
          {props.value ? (
            // локальный файл из public/uploads — оптимизация next/image здесь не нужна
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.value} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-ink-subtle">пусто</span>
          )}
        </div>
        <div className="text-sm">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="block w-full text-xs text-ink-muted file:mr-3 file:rounded file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-ink"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          {props.hint && <p className="mt-1 text-xs text-ink-subtle">{props.hint}</p>}
          {busy && <p className="mt-1 text-xs text-accent-bright">Загружаю…</p>}
          {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
          {props.value && (
            <button type="button" className="mt-1 text-xs text-ink-subtle underline" onClick={() => props.onChange(null)}>
              убрать
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Кнопка сохранения: PATCH на url, затем refresh серверных данных страницы. */
export function SaveButton({ url, data, label = "Сохранить" }: { url: string; data: unknown; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          start(async () => {
            const res = await fetch(url, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(data),
            });
            if (!res.ok) {
              const j = (await res.json().catch(() => ({}))) as { error?: string };
              setMsg(j.error ?? "Ошибка сохранения");
              return;
            }
            setMsg("Сохранено");
            router.refresh();
          });
        }}
      >
        {pending ? "…" : label}
      </Button>
      {msg && <span className="text-sm text-ink-muted">{msg}</span>}
    </div>
  );
}
