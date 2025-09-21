import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import HeaderNav from "@/components/HeaderNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CoreIndex",
  description: "CoreIndex – Index Launcher",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Sticky header; center nav to viewport with w-screen flex */}
        <header className="sticky top-0 z-50 w-full">
          <div className="w-full py-4">
            <div className="w-screen flex justify-center">
              <HeaderNav />
            </div>
          </div>
        </header>
        <main>
          <div className="mx-auto max-w-[1440px] px-6 py-8 min-h-[calc(100dvh-80px)]">{children}</div>
        </main>
      </body>
    </html>
  );
}
