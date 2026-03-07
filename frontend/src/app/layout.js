"use client";

import { usePathname } from "next/navigation";
import { Inter } from "next/font/google";
import Link from "next/link";
import { Plus } from "lucide-react";
import Navbar from "@/components/Navbar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }) {
  const pathname = usePathname();

  const navLinks = [
    { name: "Dashboard", href: "/" },
    { name: "Decision Studio", href: "/studio" },
    { name: "Active Portfolio", href: "/portfolio" },
    { name: "Review Station", href: "/review" },
  ];

  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-[#0B0E14] text-slate-50 antialiased selection:bg-blue-500/30`}>
        {/* Glow Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-[120px]" />
          <div className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] rounded-full bg-teal-900/10 blur-[100px]" />
        </div>

        <div className="relative z-10 flex flex-col min-h-screen">
          <Navbar />


          <main className="flex-1 container mx-auto px-4 sm:px-6 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
