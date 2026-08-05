"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FORMAT_PRESETS } from "@/studio/editor/model";

// Создание новой публикации → POST /api/studio/designs → переход в редактор.
// Формат по умолчанию — первый пресет (пост 1920×1080), дальше меняется в самом редакторе.

export function CreateDesign() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const { w, h } = FORMAT_PRESETS[0];
    const res = await fetch("/api/studio/designs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ w, h }),
    });
    if (res.ok) {
      const d = (await res.json()) as { id: number };
      router.push(`/studio/editor/${d.id}`);
    } else {
      setBusy(false);
    }
  }

  return (
    <Button type="button" disabled={busy} onClick={() => void create()}>
      + Создать публикацию
    </Button>
  );
}
