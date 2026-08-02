import type { Metadata } from "next";
import { SITE_MAX_W } from "../../_components/ui";

// UNDERBEER 2.0 — сборка шоу-команд из живого ростера. Операторский инструмент эфира:
// капитаны по очереди драфтят игроков, у каждой команды по разу есть «закрепить» и «украсть».
// Живёт в служебной части (за паролем); публике отдаём только «голый» рендер /underbeer/render/[id].

export const metadata: Metadata = {
  title: "UNDERBEER 2.0",
};

export default function UnderbeerLayout({ children }: { children: React.ReactNode }) {
  return <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>{children}</main>;
}
