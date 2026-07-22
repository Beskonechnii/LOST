"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UploadKind } from "@/lib/profiles";

// Мелкие клиентские кирпичики студии: поля, загрузка картинок, кнопка сохранения.
// Данные читают серверные страницы, пишут — эти компоненты через /api/studio/*.

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs uppercase tracking-widest text-neutral-500">{children}</span>;
}

const inputCls =
  "w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-violet-500";

export function TextField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <Label>{props.label}</Label>
      <input
        className={inputCls}
        type={props.type ?? "text"}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
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
      <textarea
        className={`${inputCls} resize-y leading-relaxed`}
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
  return (
    <label className="block">
      <Label>{props.label}</Label>
      <select className={inputCls} value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
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
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded border border-neutral-800 bg-neutral-900">
          {props.value ? (
            // локальный файл из public/uploads — оптимизация next/image здесь не нужна
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.value} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-neutral-600">пусто</span>
          )}
        </div>
        <div className="text-sm">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="block w-full text-xs text-neutral-400 file:mr-3 file:rounded file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-neutral-200"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          {props.hint && <p className="mt-1 text-xs text-neutral-600">{props.hint}</p>}
          {busy && <p className="mt-1 text-xs text-violet-400">Загружаю…</p>}
          {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
          {props.value && (
            <button type="button" className="mt-1 text-xs text-neutral-500 underline" onClick={() => props.onChange(null)}>
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
      <button
        type="button"
        disabled={pending}
        className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
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
      </button>
      {msg && <span className="text-sm text-neutral-400">{msg}</span>}
    </div>
  );
}
