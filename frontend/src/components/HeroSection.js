"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight } from "lucide-react";
import { Button } from "./ui/Button";

export default function HeroSection({ itemVariants }) {
  const router = useRouter();

  return (
    <motion.div variants={itemVariants} className="relative text-center mb-16 mt-4 space-y-6 pt-10 pb-8">
      
      {/* Subtle glowing background effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] h-[400px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none mix-blend-screen" aria-hidden="true" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(50%+40px)] w-full max-w-[600px] h-[300px] bg-purple-600/15 blur-[100px] rounded-full pointer-events-none mix-blend-screen" aria-hidden="true" />

      <div className="relative z-10 px-4">
        <motion.div 
          whileHover={{ scale: 1.05 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-sm font-medium text-slate-300 shadow-sm backdrop-blur-md mb-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          tabIndex={0}
          role="button"
        >
          <Activity className="w-4 h-4 text-blue-400" aria-hidden="true" />
          <span>Autonomous AI Credit Officer</span>
        </motion.div>
        
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white via-blue-100 to-slate-400 pb-2 leading-[1.1] max-w-4xl mx-auto">
          Intelligent Corporate<br className="hidden sm:block" /> Underwriting
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto font-light leading-relaxed mt-4">
          Upload financials to trigger end-to-end ML credit scoring, automated web-scale diligence, scenario simulation, and structured CAM generation.
        </p>

        {/* Call to Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <Button 
            variant="primary" 
            size="lg" 
            className="w-full sm:w-auto"
            onClick={() => router.push('/proposal/new')}
            icon={ArrowRight}
          >
            Start New Workflow
          </Button>
          <Button 
            variant="secondary" 
            size="lg" 
            className="w-full sm:w-auto"
            onClick={() => router.push('/studio')}
          >
            Explore Decision Studio
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
