import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Club Rugby Tipping",
  description: "Rugby tipping competition — pick the winners and top the table.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} min-h-screen`}>
        <Navbar />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
