"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, X } from "lucide-react";
import { AnimatedAIChat } from "@/components/ui/animated-ai-chat";

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = "";
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] bg-slate-950/88 backdrop-blur-xl"
          >
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.14),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.12),_transparent_30%)]" />

            <div className="absolute top-5 right-5 z-[150] flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                Intelli Assist
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close AI chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <AnimatedAIChat className="px-4 sm:px-8" />
          </motion.div>
        )}
      </AnimatePresence>

      {!isOpen && (
        <motion.button
          type="button"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-[130] inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white text-slate-950 shadow-lg transition-shadow hover:shadow-xl"
          aria-label="Open AI chat"
        >
          <MessageSquare className="h-6 w-6" />
        </motion.button>
      )}
    </>
  );
}
