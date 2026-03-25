import { Inter } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import Providers from "@/components/Providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Intelli-Credit | Enterprise Credit Decisioning",
  description: "AI-powered credit analysis and automated underwriting platform.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.className} min-h-screen bg-background text-foreground antialiased selection:bg-primary/30 overflow-hidden`}>
        {/* Glow Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] rounded-full bg-success/5 blur-[100px]" />
        </div>

        <Providers>
          <div className="relative z-10 flex h-screen w-full overflow-hidden">
            <div className="shrink-0 h-screen">
              <Sidebar />
            </div>

            <main className="flex-1 overflow-x-hidden overflow-y-auto relative z-10 bg-background/50 flex flex-col h-screen">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
