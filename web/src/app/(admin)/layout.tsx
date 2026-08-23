import type { Metadata } from "next";
import { AdminNav } from "../_components/site-nav";
import { BackBar } from "../_components/back-button";
import { isAdmin } from "@/lib/admin-session";

// Служебная часть: студия графики, правка ростера, вход. Всё это закрыто паролем
// (`needsAdmin()` в src/lib/auth.ts) и посетителю не показывается.
//
// noindex — не защита, а гигиена: страницы и так за паролем, но светиться в выдаче им незачем.

export const metadata: Metadata = {
  title: { default: "Админка — LOST", template: "%s — админка LOST" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminNav isAdmin={await isAdmin()} />
      <BackBar fallback="/admin" hideOn={["/admin"]} />
      {children}
    </>
  );
}
