import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { WalletProvider } from "@/components/WalletProvider";
import { Toaster } from "@/components/ui/sonner";
import { ExtensionErrorSuppressor } from "@/components/ExtensionErrorSuppressor";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PharmaDNA - Truy xuất nguồn gốc thuốc bằng Blockchain & AIoT",
  description:
    "Mỗi lô thuốc là một NFT duy nhất, đảm bảo minh bạch và xác minh nguồn gốc",
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ExtensionErrorSuppressor />
        <WalletProvider>
          <Header />
          <main className="min-h-screen bg-gray-50">{children}</main>
          <Toaster />
        </WalletProvider>
      </body>
    </html>
  );
}
