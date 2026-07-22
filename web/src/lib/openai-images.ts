// Генерация картинок через OpenAI Images API. ТОЛЬКО серверный модуль: читает OPENAI_API_KEY,
// импортировать из клиентских компонентов нельзя. Варианты настроек — в src/lib/image-options.ts.
//
// Два эндпоинта, разница только в наличии референсов:
//   без референсов → POST /v1/images/generations (JSON)
//   с референсами  → POST /v1/images/edits (multipart, файлы полем image[])
// Модели gpt-image-* всегда возвращают base64 и не принимают response_format — поэтому его не шлём.

const API = "https://api.openai.com/v1";

export type GenerateParams = {
  model: string;
  prompt: string;
  size: string;
  quality: string;
  n: number;
  /** Референсы: если непусто — идём в /images/edits, и картинки становятся основой правки. */
  references: File[];
};

/** Картинка результата: base64 без префикса data: и формат файла. */
export type GeneratedImage = { b64: string; format: string };

export class OpenAIError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type ApiResponse = {
  data?: { b64_json?: string; url?: string }[];
  output_format?: string;
  error?: { message?: string };
};

export async function generateImages(p: GenerateParams): Promise<GeneratedImage[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new OpenAIError("OPENAI_API_KEY не задан в web/.env", 500);

  const withRefs = p.references.length > 0;
  const res = await fetch(`${API}/images/${withRefs ? "edits" : "generations"}`, {
    method: "POST",
    headers: withRefs
      ? { authorization: `Bearer ${key}` } // boundary для multipart проставит fetch сам
      : { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: withRefs ? editsBody(p) : JSON.stringify(commonFields(p)),
  });

  const json = (await res.json().catch(() => ({}))) as ApiResponse;
  if (!res.ok) {
    throw new OpenAIError(json.error?.message ?? `OpenAI ответил ${res.status}`, res.status);
  }

  const format = json.output_format ?? "png";
  const images = (json.data ?? []).flatMap((d) => (d.b64_json ? [{ b64: d.b64_json, format }] : []));
  if (images.length === 0) throw new OpenAIError("OpenAI вернул пустой ответ", 502);
  return images;
}

/** Поля, общие для обоих эндпоинтов. size/quality = "auto" не шлём — пусть решает модель. */
function commonFields(p: GenerateParams) {
  const fields: Record<string, string | number> = { model: p.model, prompt: p.prompt, n: p.n };
  if (p.size !== "auto") fields.size = p.size;
  if (p.quality !== "auto") fields.quality = p.quality;
  return fields;
}

function editsBody(p: GenerateParams): FormData {
  const body = new FormData();
  for (const [k, v] of Object.entries(commonFields(p))) body.set(k, String(v));
  // именно image[] — так эндпоинт принимает несколько референсов
  for (const file of p.references) body.append("image[]", file, file.name);
  return body;
}
