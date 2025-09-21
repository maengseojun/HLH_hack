import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import HeaderNav from "@/components/HeaderNav";
import PrivyClientProvider from "@/components/providers/PrivyClientProvider";
import HeaderWalletButton from "@/components/HeaderWalletButton";

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
        <PrivyClientProvider>
          {/* Sticky transparent header with brand left, nav center, wallet right */}
          <header className="sticky top-0 z-50 w-full">
            <div className="relative mx-auto max-w-[1440px] px-6 py-3">
              {/* Brand (left) */}
              <div className="absolute left-4 top-1/2 -translate-y-1/2 select-none">
                <div className="text-white font-bold text-2xl leading-none tracking-tight">CoreIndex</div>
              </div>
              {/* Nav (center) */}
              <div className="flex justify-center">
                <HeaderNav />
              </div>
              {/* Wallet (right) */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <HeaderWalletButton />
              </div>
            </div>
          </header>
          <main>
            <div className="mx-auto max-w-[1440px] px-6 py-8 min-h-[calc(100dvh-80px)]">{children}</div>
          </main>
        </PrivyClientProvider>
      </body>
    </html>
  );
}
