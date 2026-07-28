import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Навигации здесь намеренно нет: она своя у каждой группы маршрутов —
          (public)/layout.tsx для продукта и (admin)/layout.tsx для служебной части. */}
      <body className="flex min-h-full flex-col bg-neutral-950 text-neutral-100">{children}</body>
    </html>
  );
}
