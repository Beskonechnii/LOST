import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemplate } from "@/studio/registry";
import type { RawPayload } from "@/studio/types";
import { getMatchOptions, getRefs } from "@/lib/studio-refs";
import { prisma } from "@/lib/prisma";
import { Wizard } from "../../_components/wizard";

export const dynamic = "force-dynamic";

export default async function NewGraphicPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ render?: string }>;
}) {
  const { templateId } = await params;
  const { render } = await searchParams;
  const template = getTemplate(templateId);
  if (!template) notFound();

  const [refs, matches] = await Promise.all([getRefs(), getMatchOptions()]);

  // ?render=<id> — открыть сохранённую генерацию и поправить.
  let initial: RawPayload | undefined;
  if (render) {
    const saved = await prisma.render.findUnique({ where: { id: Number(render) } });
    if (saved?.templateId === templateId) initial = JSON.parse(saved.payload) as RawPayload;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/studio" className="text-sm text-neutral-500 hover:text-neutral-300">
          ← Шаблоны
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{template.title}</h1>
        <p className="text-sm text-neutral-500">{template.description}</p>
      </div>

      <Wizard templateId={templateId} refs={refs} matches={matches} initial={initial} />
    </div>
  );
}
