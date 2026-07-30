import { Generator } from "../_components/generator";

// Генерация картинок по API (OpenAI Images). В отличие от шаблонов, здесь не сборка из данных лиги,
// а свободная генерация: промт + настройки → готовые файлы.

export const metadata = { title: "Генерация — Студия LOST" };

export default function GeneratePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Генерация по API</h1>
        <p className="text-sm text-ink-subtle">
          Картинки от OpenAI по промту. Каждая генерация — платная, счёт идёт на аккаунт из ключа.
        </p>
      </div>

      <Generator />
    </div>
  );
}
