// Варианты настроек генерации картинок. Чистые данные — модуль безопасно импортировать и на клиенте
// (в отличие от src/lib/openai-images.ts, который ходит в API с ключом и остаётся серверным).

/** Модели, доступные аккаунту (сверено запросом GET /v1/models). */
export const IMAGE_MODELS = [
  { value: "gpt-image-2", label: "GPT Image 2 — лучшее качество, медленнее" },
  { value: "gpt-image-1.5", label: "GPT Image 1.5 — предыдущее поколение" },
  { value: "gpt-image-1", label: "GPT Image 1" },
  { value: "gpt-image-1-mini", label: "GPT Image 1 mini — дешевле и быстрее" },
] as const;

export const IMAGE_SIZES = [
  { value: "auto", label: "Авто (решает модель)" },
  { value: "1024x1024", label: "Квадрат 1024×1024" },
  { value: "1536x1024", label: "Горизонталь 1536×1024" },
  { value: "1024x1536", label: "Вертикаль 1024×1536" },
] as const;

export const IMAGE_QUALITIES = [
  { value: "auto", label: "Авто" },
  { value: "low", label: "Низкое — черновик, дёшево" },
  { value: "medium", label: "Среднее" },
  { value: "high", label: "Высокое — дороже и дольше" },
] as const;

export const MAX_IMAGES = 10; // предел n у API
export const MAX_REFERENCES = 16; // предел числа входных картинок у gpt-image-*

const allowed = (list: readonly { value: string }[], v: string) => list.some((o) => o.value === v);

export const isModel = (v: string) => allowed(IMAGE_MODELS, v);
export const isSize = (v: string) => allowed(IMAGE_SIZES, v);
export const isQuality = (v: string) => allowed(IMAGE_QUALITIES, v);
