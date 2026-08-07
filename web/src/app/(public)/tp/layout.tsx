import { SITE_MAX_W } from "../../_components/ui";
import { BackButton } from "../../_components/back-button";

// TP — сезонный зачёт очков MVP. Публичная витрина раздела сезона LOST S2 (открывается плиткой
// с хаба сезона), своих подвкладок нет: страница одна. Правят TP в служебной части (/admin/tp).
export default function TpLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <BackButton fallback="/standings" className="mb-4" />
      {children}
    </main>
  );
}
