"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { name: "Dashboard", href: "/" },
    { name: "Decision Studio", href: "/studio" },
    { name: "Active Portfolio", href: "/portfolio" },
    { name: "Review Station", href: "/review" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#0B0E14]/50 backdrop-blur-lg shadow-sm transition-all duration-300">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        
        {/* Logo Section */}
        <Link href="/" className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl p-1 -ml-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-teal-400 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white" aria-hidden="true"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
              Intelli-Credit
            </span>
          </div>
          <span className="ml-2 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-[10px] font-bold text-blue-400 tracking-widest hidden sm:block">
            ENTERPRISE
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 mx-4" aria-label="Main Navigation">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link 
                key={link.name} 
                href={link.href} 
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isActive 
                    ? "text-white bg-slate-800/80" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {link.name}
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-t-full shadow-[0_-2px_8px_rgba(59,130,246,0.8)]" aria-hidden="true" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-5">
          <Link
            href="/studio"
            className="hidden md:flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] border border-blue-500/50 transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0E14]"
            aria-label="Create New Workflow"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            New Workflow
          </Link>
          
          {/* User Avatar */}
          <button 
            className="h-9 w-9 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden hover:border-slate-500 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="User profile menu"
          >
            <div className="w-full h-full bg-gradient-to-tr from-slate-600 to-slate-400 opacity-50" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
