"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Создать пустую fearless-сессию и уйти в неё. Создание — POST (запись), список серверный.

export function NewFearlessButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/fearless", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!res.ok) throw new Error(await res.text());
      const session = (await res.json()) as { id: number };
      router.push(`/admin/fearless-draft/${session.id}`);
    } catch (e) {
      toast.error(`Не удалось создать драфт: ${e instanceof Error ? e.message : e}`);
      setBusy(false);
    }
  }

  return (
    <Button onClick={create} disabled={busy} className="shrink-0">
      {busy ? "Создаю…" : "Новый драфт"}
    </Button>
  );
}
