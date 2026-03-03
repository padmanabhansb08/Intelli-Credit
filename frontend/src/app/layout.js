import { Inter } from "next/font/google";
import Link from "next/link";
import { Plus } from "lucide-react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "AI Credit Decisioning Engine",
  description: "Enterprise-grade automated CAM generator and risk assessment platform.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-[#0B0E14] text-slate-50 antialiased selection:bg-blue-500/30`}>
        {/* Glow Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-[120px]" />
          <div className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] rounded-full bg-teal-900/10 blur-[100px]" />
        </div>

        <div className="relative z-10 flex flex-col min-h-screen">
          <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#0B0E14]/80 backdrop-blur-md">
            <div className="container mx-auto px-6 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                </div>
                <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                  Intelli-Credit
                </span>
                <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-semibold text-blue-400 tracking-wider">
                  ENTERPRISE
                </span>
              </div>
              <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
                <Link href="/" className="text-white hover:text-blue-400 transition-colors">Dashboard</Link>
                <Link href="/studio" className="hover:text-blue-400 transition-colors flex items-center gap-2">Decision Studio</Link>
                <Link href="/portfolio" className="hover:text-blue-400 transition-colors">Active Portfolio</Link>
                <Link href="/review" className="hover:text-blue-400 transition-colors">Review Station</Link>
              </nav>
              <div className="flex items-center gap-4">
                <Link
                  href="/studio"
                  className="hidden md:flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg shadow-blue-500/20 transition-all transform hover:scale-105"
                >
                  <Plus className="w-4 h-4" />
                  New Workflow
                </Link>
                <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden cursor-pointer">
                  <div className="w-4 h-4 rounded-full bg-slate-500 object-cover" />
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 container mx-auto px-4 sm:px-6 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
