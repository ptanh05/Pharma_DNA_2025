import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PharmaDNA - Truy xuất nguồn gốc thuốc bằng Blockchain & AIoT",
  description:
    "Mỗi lô thuốc là một NFT duy nhất, đảm bảo minh bạch và xác minh nguồn gốc",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className={inter.className}>
        <Header />
        <main className="min-h-screen bg-gray-50">{children}</main>
      </body>
    </html>
  );
}
