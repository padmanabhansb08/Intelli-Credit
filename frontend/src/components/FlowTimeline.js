"use client";

import { motion } from "framer-motion";
import { Database, Activity, Building2, ShieldCheck, FileText } from "lucide-react";
import FlowStep from "./FlowStep";

export default function FlowTimeline({ itemVariants }) {
  const steps = [
    { step: 1, title: "Data Ingestion", desc: "Extract structured ratios from PDFs via OCR fallback pipelines.", icon: Database, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
    { step: 2, title: "Risk Modeling", desc: "Calculate PD and recommended exposure using Scikit-Learn tree ensembles.", icon: Activity, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
    { step: 3, title: "Web Intelligence", desc: "Simulates NLP sentiment analysis for ESG and litigation flags.", icon: Building2, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" },
    { step: 4, title: "Explainable Decisions", desc: "Outputs SHAP value importance alongside a fully formatted CAM PDF.", icon: ShieldCheck, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" }
  ];

  return (
    <motion.div 
      variants={itemVariants}
      whileHover={{ scale: 1.01, transition: { duration: 0.3 } }}
      className="glass-panel rounded-3xl p-8 relative overflow-hidden flex-grow border border-white/5 bg-slate-900/40 backdrop-blur-md hover:bg-slate-800/40 hover:border-white/10 hover:shadow-[0_15px_50px_-15px_rgba(0,0,0,0.4)] transition-all duration-500 ease-out group"
    >
      {/* Subtle top edge highlight */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-slate-400/0 via-slate-400/30 to-slate-400/0 opacity-50 group-hover:opacity-100 transition-opacity duration-500" aria-hidden="true" />

      <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none transition-transform duration-700 group-hover:scale-110 group-hover:rotate-3">
        <Activity className="w-48 h-48" aria-hidden="true" />
      </div>
      
      <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
        <FileText className="w-6 h-6 text-slate-400 group-hover:text-blue-400 transition-colors duration-300" aria-hidden="true" />
        Automated Underwriting Flow
      </h3>
      
      <div className="relative mt-8">
        {/* Main vertical connecting line */}
        <div className="absolute left-[2.18rem] top-8 bottom-8 w-1 bg-gradient-to-b from-blue-500 via-slate-600 to-transparent hidden sm:block shadow-[0_0_15px_rgba(59,130,246,0.6)] rounded-full" aria-hidden="true"></div>
        
        <div className="space-y-6 relative" role="list" aria-label="Underwriting Flow Steps">
          {steps.map((item, idx) => (
            <div role="listitem" key={idx}>
               <FlowStep 
                 {...item}
                 delay={0.1 + (idx * 0.1)} 
               />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
