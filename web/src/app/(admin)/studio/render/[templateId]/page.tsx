import { notFound } from "next/navigation";
import { getTemplate } from "@/studio/registry";
import { resolvePayload } from "@/studio/resolve";
import type { RawPayload } from "@/studio/types";
import { getRefs } from "@/lib/studio-refs";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// «Голый» рендер шаблона в натуральном размере, без интерфейса студии.
// ?render=<id> — из истории, ?p=<base64 JSON> — произвольный payload.
// Эта же страница станет целью серверного скриншота (Playwright), когда понадобится рендер по API.

export default async function RenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ render?: string; p?: string }>;
}) {
  const { templateId } = await params;
  const { render, p } = await searchParams;
  const template = getTemplate(templateId);
  if (!template) notFound();

  let payload: RawPayload = {};
  if (render) {
    const saved = await prisma.render.findUnique({ where: { id: Number(render) } });
    if (saved?.templateId === templateId) payload = JSON.parse(saved.payload) as RawPayload;
  } else if (p) {
    payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as RawPayload;
  }

  const data = resolvePayload(template.fields, payload, await getRefs());
  const { Render, size } = template;

  return (
    <div style={{ width: size.w, height: size.h, overflow: "hidden" }}>
      <Render data={data} />
    </div>
  );
}
