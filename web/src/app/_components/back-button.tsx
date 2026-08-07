"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Кнопка «Назад» разделов-хабов: с плитки провалились в инструмент — этой кнопкой вернулись.
// Обычно это честный «назад» по истории; если пришли по прямой ссылке (истории нет) — уводим
// на фолбэк-хаб, а не за пределы сайта. hideOn — пути (точное совпадение) самих хабов, где кнопка
// не нужна: назад с хаба ведёт верхняя вкладка, а не эта кнопка.
export function BackButton({
  fallback,
  hideOn = [],
  className = "",
}: {
  fallback: string;
  hideOn?: string[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  if (hideOn.includes(pathname)) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() => (typeof window !== "undefined" && window.history.length > 1 ? router.back() : router.push(fallback))}
    >
      ← Назад
    </Button>
  );
}

// Отдельная строка с кнопкой «Назад» под навигацией — для разделов без общего контент-контейнера
// (админка: у каждого инструмента свой main). Прячет всю строку целиком на путях hideOn, чтобы на
// самом хабе не оставалась пустая полоса.
export function BackBar({ fallback, hideOn = [] }: { fallback: string; hideOn?: string[] }) {
  const pathname = usePathname();
  if (hideOn.includes(pathname)) return null;

  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 pt-6 md:px-6">
      <BackButton fallback={fallback} />
    </div>
  );
}
