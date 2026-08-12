import { Generator } from "../_components/generator";

// Генерация картинок по API (OpenAI Images). В отличие от шаблонов, здесь не сборка из данных лиги,
// а свободная генерация: промт + настройки → готовые файлы.

export const metadata = { title: "Генерация — Студия LOST" };

export default function GeneratePage() {
  return (
    <div className="space-y-6 font-pouf">
      <div>
        <h1 className="text-[28px] font-black tracking-[-0.5px] text-ink md:text-4xl">Генерация по API</h1>
        <p className="text-sm font-bold text-muted">
          Картинки от OpenAI по промту. Каждая генерация — платная, счёт идёт на аккаунт из ключа.
        </p>
      </div>

      <Generator />
    </div>
  );
}
