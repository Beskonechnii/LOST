import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Утилита shadcn/ui: склеивает классы (clsx) и разрешает конфликты Tailwind (tailwind-merge),
// чтобы `cn("px-2", cond && "px-4")` дал ровно один px-*. Нужна всем компонентам из src/components/ui.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
