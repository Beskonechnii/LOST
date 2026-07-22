import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { generateImages, OpenAIError } from "@/lib/openai-images";
import { isModel, isQuality, isSize, MAX_IMAGES, MAX_REFERENCES } from "@/lib/image-options";

// Генерация картинок в студии: multipart { model, prompt, size, quality, n, ref } →
// файлы в public/uploads/generated + пути. Ключ OpenAI читается здесь и наружу не отдаётся.

export const maxDuration = 300; // картинки в высоком качестве считаются долго

const MAX_REF_BYTES = 8 * 1024 * 1024;
const REF_MIME = ["image/png", "image/jpeg", "image/webp"];
const DIR = "generated";

export async function POST(req: Request) {
  const form = await req.formData();
  const model = String(form.get("model") ?? "");
  const prompt = String(form.get("prompt") ?? "").trim();
  const size = String(form.get("size") ?? "auto");
  const quality = String(form.get("quality") ?? "auto");
  const n = Number(form.get("n") ?? 1);
  const references = form.getAll("ref").filter((f): f is File => f instanceof File && f.size > 0);

  if (!prompt) return bad("Промт пустой");
  if (!isModel(model)) return bad(`Модель «${model || "?"}» не поддержана`);
  if (!isSize(size)) return bad(`Размер «${size}» не поддержан`);
  if (!isQuality(quality)) return bad(`Качество «${quality}» не поддержано`);
  if (!Number.isInteger(n) || n < 1 || n > MAX_IMAGES) return bad(`Количество: от 1 до ${MAX_IMAGES}`);
  if (references.length > MAX_REFERENCES) return bad(`Референсов не больше ${MAX_REFERENCES}`);

  for (const ref of references) {
    if (!REF_MIME.includes(ref.type)) return bad(`Референс «${ref.name}»: нужен png, jpeg или webp`);
    if (ref.size > MAX_REF_BYTES) return bad(`Референс «${ref.name}» больше ${MAX_REF_BYTES / 1024 / 1024} МБ`);
  }

  try {
    const images = await generateImages({ model, prompt, size, quality, n, references });

    const dir = path.join(process.cwd(), "public", "uploads", DIR);
    await fs.mkdir(dir, { recursive: true });
    const paths = await Promise.all(
      images.map(async (img) => {
        const name = `${randomUUID()}.${img.format}`;
        await fs.writeFile(path.join(dir, name), Buffer.from(img.b64, "base64"));
        return `/uploads/${DIR}/${name}`;
      }),
    );

    return NextResponse.json({ paths });
  } catch (e) {
    if (e instanceof OpenAIError) {
      // 4xx от OpenAI — вина запроса (промт, лимиты), отдаём текст как есть
      return NextResponse.json({ error: e.message }, { status: e.status >= 500 ? 502 : e.status });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Не удалось сгенерировать" }, { status: 500 });
  }
}

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
