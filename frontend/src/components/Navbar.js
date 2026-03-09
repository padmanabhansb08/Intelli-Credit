"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut, User, Key, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const navLinks = [
    { name: "Workspace", href: "/" },
    { name: "Decision Studio", href: "/studio" },
    { name: "Portfolio", href: "/portfolio" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg shadow-sm transition-all duration-300">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">

        {/* Logo Section */}
        <Link href="/" className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl p-1 -ml-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-shadow duration-300 border border-primary/30">
            <ShieldCheck className="w-6 h-6 text-primary-foreground" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight text-foreground">
              Intelli-Credit
            </span>
          </div>
          <span className="ml-2 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-[10px] font-bold text-primary tracking-widest hidden sm:block">
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
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isActive
                  ? "text-foreground bg-secondary/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}
                aria-current={isActive ? "page" : undefined}
              >
                {link.name}
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-t-full shadow-sm" aria-hidden="true" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Auth Section */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={signOut}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
              >
                <LogOut size={16} />
                Sign Out
              </button>
              <div className="relative group cursor-pointer" title={user.email}>
                <div className="w-10 h-10 rounded-full bg-secondary/80 border border-border flex items-center justify-center text-foreground font-bold text-sm shadow-sm backdrop-blur-md transition-all duration-300 group-hover:bg-secondary group-hover:border-primary/50">
                  {user.email ? user.email.substring(0, 2).toUpperCase() : "US"}
                </div>
              </div>
            </div>
          ) : (
            <Link href="/login" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
