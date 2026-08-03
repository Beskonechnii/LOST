"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Кнопка «Назад» на странице серии. Обычно сюда приходят из таблицы, архива или статистики —
// честный «назад» по истории и возвращает туда. Если истории нет (открыли по прямой ссылке),
// уводим на переданный фолбэк (таблица дивизиона), а не за пределы сайта.
export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => (typeof window !== "undefined" && window.history.length > 1 ? router.back() : router.push(fallback))}
    >
      ← Назад
    </Button>
  );
}
