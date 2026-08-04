import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { normalizeDoc } from "@/studio/editor/model";
import { BUILTIN_FONTS } from "@/studio/editor/fonts";
import { discoverFonts } from "@/studio/editor/fonts-server";
import { Workspace } from "../_components/workspace";
import { DeleteDesign } from "../_components/delete-design";

export const dynamic = "force-dynamic";

// Страница редактирования одного документа: серверная обёртка грузит Design.doc и отдаёт клиентский
// воркспейс. Раскладка правится целиком на клиенте, сохранение — PUT /api/studio/designs/[id].

export default async function DesignEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [design, discovered] = await Promise.all([
    prisma.design.findUnique({ where: { id } }),
    discoverFonts(),
  ]);
  if (!design) notFound();

  const doc = normalizeDoc(JSON.parse(design.doc) as unknown);
  // системные шрифты + подхваченные из public/fonts (файловые перекрывают одноимённые системные)
  const fonts = [...BUILTIN_FONTS, ...discovered];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/studio/editor" className="text-xs text-ink-subtle hover:text-ink">
          ← к списку документов
        </Link>
        <DeleteDesign id={design.id} title={design.title} redirectTo="/studio/editor" full />
      </div>
      <Workspace id={design.id} initialTitle={design.title ?? ""} initialDoc={doc} fonts={fonts} />
    </div>
  );
}
