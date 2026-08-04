"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FORMAT_PRESETS } from "@/studio/editor/model";

// Создание нового документа: выбор формата → POST /api/studio/designs → переход в редактор.

export function CreateDesign() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function create(w: number, h: number) {
    setBusy(true);
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
    <div className="flex flex-wrap gap-2">
      {FORMAT_PRESETS.map((p) => (
        <Button key={p.label} type="button" variant="outline" size="sm" disabled={busy} onClick={() => void create(p.w, p.h)}>
          + {p.label}
        </Button>
      ))}
    </div>
  );
}
