import { readTheme } from "@/lib/theme-store";
import { ThemeAdmin } from "./_components/theme-admin";

export const metadata = { title: "Тема" };

// Панель управления цветами UI. Текущие значения читаем на сервере из data/theme.json и отдаём в
// редактор; тот правит локально (живое превью) и сохраняет через PUT /api/theme.

export default async function ThemePage() {
  const theme = await readTheme();
  return (
    <main className="mx-auto w-full max-w-[96rem] flex-1 px-4 py-8 md:px-6">
      <ThemeAdmin initial={theme} />
    </main>
  );
}
