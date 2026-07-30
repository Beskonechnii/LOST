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
      className="inline-flex items-center gap-1 rounded-md border border-hairline px-2.5 py-1 text-xs text-ink-muted transition hover:border-accent-bright hover:bg-accent-bright/10 hover:text-accent-bright"
    >
      ← Назад
    </button>
  );
}
