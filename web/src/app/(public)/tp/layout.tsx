import { SeasonNav } from "../../_components/site-nav";
import { SITE_MAX_W } from "../../_components/ui";

// TP — сезонный зачёт очков MVP. Публичная витрина под сезоном LOST S2 (первый ряд — SeasonNav),
// своих подвкладок нет: страница одна. Правят TP в служебной части (/admin/tp).
export default function TpLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SeasonNav />
      <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>{children}</main>
    </>
  );
}
