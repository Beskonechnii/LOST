"use client";

import { useRouter } from "next/navigation";

// Кнопка «Назад» на странице серии. Обычно сюда приходят из таблицы, архива или статистики —
// честный «назад» по истории и возвращает туда. Если истории нет (открыли по прямой ссылке),
// уводим на переданный фолбэк (таблица дивизиона), а не за пределы сайта.
export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => (typeof window !== "undefined" && window.history.length > 1 ? router.back() : router.push(fallback))}
      className="inline-flex items-center gap-1 rounded-md border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 transition hover:border-violet-500 hover:bg-violet-500/10 hover:text-violet-200"
    >
      ← Назад
    </button>
  );
}
