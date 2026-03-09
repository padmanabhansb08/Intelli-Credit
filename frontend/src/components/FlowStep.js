"use client";

import { motion } from "framer-motion";
import React, { memo } from "react";

const FlowStep = memo(({ 
  step, 
  title, 
  desc, 
  icon: Icon, 
  color, 
  bg, 
  border, 
  delay = 0 
}) => {
  return (
    <motion.div 
      whileHover={{ x: 4 }}
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay }}
      className="relative flex flex-col sm:flex-row items-start gap-6 group/step cursor-pointer"
    >
      {/* Step Number Indicator */}
      <div className="relative z-10 flex-shrink-0 w-16 h-16 rounded-2xl bg-slate-900 flex flex-col items-center justify-center border-2 border-slate-700 text-slate-300 shadow-lg group-hover/step:border-slate-500 group-hover/step:scale-110 transition-all duration-300 overflow-hidden">
        <div className={`absolute inset-0 opacity-0 group-hover/step:opacity-20 transition-opacity duration-300 ${bg}`} aria-hidden="true"></div>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-0.5 group-hover/step:text-slate-400 transition-colors">Step</span>
        <span className={`text-xl font-black ${color}`}>{step}</span>
      </div>

      {/* Step Content Card */}
      <div className="flex-1 glass-panel rounded-2xl p-5 border border-slate-700/50 bg-slate-800/30 group-hover/step:bg-slate-800/60 group-hover/step:-translate-y-1 group-hover/step:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] transition-all duration-300">
        <div className="flex items-start gap-4">
          <div className={`p-2.5 rounded-xl ${bg} ${border} border shadow-sm group-hover/step:scale-110 transition-transform duration-300`}>
            <Icon className={`w-5 h-5 ${color}`} aria-hidden="true" />
          </div>
          <div>
            <strong className="text-slate-100 font-bold block mb-1.5 text-lg group-hover/step:text-white transition-colors">{title}</strong>
            <span className="text-slate-400 leading-relaxed text-sm group-hover/step:text-slate-300 transition-colors">{desc}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

FlowStep.displayName = "FlowStep";
export default FlowStep;
