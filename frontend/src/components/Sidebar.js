"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Workflow, 
  FileCheck2, 
  BarChart3, 
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  LogOut,
  Zap
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const navLinks = [
    { name: "Workspace", href: "/", icon: LayoutDashboard },
    { name: "Simulation Lab", href: "/simulation", icon: Zap },
    { name: "Decision Studio", href: "/decision-studio", icon: Workflow },
    { name: "Policies", href: "/decision-studio/policies", icon: FileCheck2 },
    { name: "Pipeline", href: "/pipeline", icon: BarChart3 },
    { name: "Portfolio", href: "/portfolio", icon: Briefcase },
  ];

  return (
    <aside 
      className={`relative z-50 h-screen transition-all duration-500 ease-in-out border-r border-black/10 dark:border-white/10 bg-background/60 backdrop-blur-2xl shadow-lg dark:shadow-2xl flex flex-col ${isExpanded ? "w-64" : "w-20"}`}
    >
      {/* Collapse/Expand Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3 top-8 bg-background border border-border rounded-full p-1 shadow-md hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary z-50"
        aria-label={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
      >
        {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* Logo Area */}
      <div className="h-24 flex items-center justify-center border-b border-border/50 shrink-0">
        <Link href="/" className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl p-1">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-gray-800 to-[#111111] flex items-center justify-center shadow-lg shadow-black/20 group-hover:shadow-black/40 transition-shadow duration-300 border border-gray-700">
            <ShieldCheck className="w-6 h-6 text-white" aria-hidden="true" />
          </div>
          {isExpanded && (
            <div className="flex flex-col whitespace-nowrap overflow-hidden transition-all duration-300">
              <span className="font-extrabold text-lg tracking-tight text-white">
                Intelli-Credit
              </span>
              <span className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">
                Enterprise
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-2 scrollbar-hide" aria-label="Main Sidebar Navigation">
        {navLinks.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`relative flex items-center h-12 rounded-xl transition-all duration-300 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
                ${isActive ? "bg-[#1A1A1A] text-white shadow-sm border border-gray-800" : "text-gray-400 hover:bg-[#111111] hover:text-white border border-transparent"}`}
              title={!isExpanded ? link.name : undefined}
            >
              <div className={`flex items-center justify-center h-full w-14 shrink-0 transition-colors duration-300 ${isActive ? "text-white" : "group-hover:text-gray-300"}`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              
              {isExpanded && (
                <span className={`font-medium text-sm whitespace-nowrap opacity-100 transition-opacity duration-300`}>
                  {link.name}
                </span>
              )}

              {/* Active Indicator Line */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full shadow-sm" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-border/50 shrink-0 flex flex-col gap-4">
        {user ? (
          <>
            <div className={`flex items-center gap-3 ${!isExpanded && "justify-center"}`}>
               <div className="relative group cursor-pointer shrink-0" title={user.email}>
                <div className="w-10 h-10 rounded-full bg-[#1A1A1A] border border-gray-800 flex items-center justify-center text-white font-bold text-sm shadow-sm backdrop-blur-md transition-all duration-300 group-hover:bg-[#222222] group-hover:border-gray-500">
                  {user.email ? user.email.substring(0, 2).toUpperCase() : "US"}
                </div>
              </div>
              {isExpanded && (
                <div className="flex flex-col whitespace-nowrap overflow-hidden">
                   <span className="text-sm font-medium text-white truncate">{user.email}</span>
                   <span className="text-xs text-gray-400 truncate">{user.role || 'Enterprise User'}</span>
                </div>
              )}
            </div>
            
            <button
               onClick={signOut}
               className={`flex items-center h-10 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors group ${!isExpanded ? 'justify-center w-10 mx-auto' : 'px-3 gap-3 w-full'}`}
               title={!isExpanded ? "Sign Out" : undefined}
            >
              <LogOut size={18} className="shrink-0 group-hover:scale-110 transition-transform" />
              {isExpanded && <span className="text-sm font-medium">Sign Out</span>}
            </button>
          </>
        ) : (
           <Link 
             href="/login" 
             className={`flex items-center justify-center h-10 rounded-lg bg-[#1A1A1A] text-white hover:bg-gray-800 transition-colors font-medium text-sm ${!isExpanded ? 'w-10 mx-auto' : 'w-full px-4'}`}
             title={!isExpanded ? "Sign In" : undefined}
           >
             {isExpanded ? "Sign In" : <LogOut size={18} />}
           </Link>
        )}
      </div>
    </aside>
  );
}
