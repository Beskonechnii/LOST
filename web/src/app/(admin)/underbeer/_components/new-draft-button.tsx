"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Создать пустую сессию драфта и уйти в неё. Отдельная кнопка-клиент: создание — это POST (запись),
// а страница-список серверная.

export function NewDraftButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/underbeer", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!res.ok) throw new Error(await res.text());
      const session = (await res.json()) as { id: number };
      router.push(`/underbeer/${session.id}`);
    } catch (e) {
      toast.error(`Не удалось создать драфт: ${e instanceof Error ? e.message : e}`);
      setBusy(false);
    }
  }

  return (
    // Цвет намеренно янтарный — фирменный акцент раздела UNDERBEER; база берётся у shadcn Button.
    <Button onClick={create} disabled={busy} className="shrink-0 bg-amber-600 text-neutral-950 hover:bg-amber-500">
      {busy ? "Создаю…" : "Новый драфт"}
    </Button>
  );
}
