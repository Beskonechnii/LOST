import type { Metadata } from "next";
import { PublicNav } from "../_components/site-nav";

// Публичная часть — то, что видит посетитель: разбор матча, таблица дивизиона, витрина ростера.
// Группа `(public)` на URL не влияет, она нужна ровно за тем, чтобы у продукта были своя
// навигация и свои метаданные, не общие со служебной частью.

export const metadata: Metadata = {
  title: { default: "LOST — League of Spirit", template: "%s — LOST" },
  description: "Разбор матчей Dota 2, таблица и составы League of Spirit",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicNav />
      {children}
    </>
  );
}
