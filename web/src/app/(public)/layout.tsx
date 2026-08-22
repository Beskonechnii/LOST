import type { Metadata } from "next";
import { PublicNav } from "../_components/site-nav";
import { isAdmin } from "@/lib/admin-session";
import { currentTournament } from "@/lib/tournaments";

// Публичная часть — то, что видит посетитель: разбор матча, таблица дивизиона, витрина ростера.
// Группа `(public)` на URL не влияет, она нужна ровно за тем, чтобы у продукта были своя
// навигация и свои метаданные, не общие со служебной частью.

export const metadata: Metadata = {
  title: { default: "League of Spirits", template: "%s — League of Spirits" },
  description: "Разбор матчей Dota 2, таблица и составы League of Spirits",
};

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicNav isAdmin={await isAdmin()} tournament={await currentTournament()} />
      {children}
    </>
  );
}
