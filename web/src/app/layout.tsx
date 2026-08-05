import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// Шрифт для компонентов 1st-Pouf (класс font-pouf → 'Nunito Variable').
import "@fontsource-variable/nunito";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LOST — League of Spirit",
  description: "Стата матчей, таблица лиги и студия графики League of Spirit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      // data-theme="dark" — сигнал тёмной темы для компонентов 1st-Pouf (они читают его,
      // а не prefers-color-scheme). Нужен на <html>, чтобы порталы Radix (Sheet/меню),
      // живущие в <body> вне обёртки страницы, тоже получали тёмную палитру pouf.
      // Наши собственные токены его не читают — на остальной сайт не влияет.
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Навигации здесь намеренно нет: она своя у каждой группы маршрутов —
          (public)/layout.tsx для продукта и (admin)/layout.tsx для служебной части. */}
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink">
        {children}
        {/* Тосты (sonner) — один хост на весь сайт; заменяют webview-глохнущий alert(). */}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
