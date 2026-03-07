"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { ShieldCheck, PlusCircle, Briefcase } from "lucide-react";

import HeroSection from "@/components/HeroSection";
import FeatureCard from "@/components/FeatureCard";

// Lazy load the timeline component since it sits below the fold
const FlowTimeline = dynamic(() => import('@/components/FlowTimeline'), {
  loading: () => <div className="glass-panel rounded-3xl p-8 h-[600px] animate-pulse flex items-center justify-center border border-white/5"><div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" /></div>,
  ssr: false
});

export default function Home() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <div className="relative max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8 min-h-screen">
      
      {/* Animated Deep Background Grid */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-25" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] animate-grid-scroll"></div>
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10"
      >
        <HeroSection itemVariants={itemVariants} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          
          {/* Left Column: Action Cards */}
          <div className="lg:col-span-7 flex flex-col gap-8">
            <FeatureCard
              title="Decision Engine Studio"
              description="Enter the interactive Canvas Studio. Visually design, deploy, and backtest complex credit decisioning graphs using drag-and-drop integration nodes."
              icon={Briefcase}
              href="/studio"
              gradientColors="from-transparent via-blue-400/50 to-transparent"
              iconBgColor="bg-emerald-500/10"
              iconColor="text-emerald-400"
              iconBorder="border-emerald-500/20"
              iconHoverShadow="rgba(16,185,129,0.3)"
              cardHoverBorder="hover:border-blue-500/50"
              cardHoverShadow="rgba(59,130,246,0.3)"
            />

            {/* Secondary Action Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FeatureCard
                title="Manual Proposal"
                description="Initiate a classic step-by-step credit origination data entry form."
                icon={PlusCircle}
                href="/proposal/new"
                delay={0.1}
                gradientColors="from-blue-400/0 via-blue-400/40 to-blue-400/0"
                iconBgColor="bg-blue-500/10"
                iconColor="text-blue-400"
                iconBorder="border-blue-500/20"
                iconHoverShadow="rgba(59,130,246,0.3)"
              />
              <FeatureCard
                title="Active Portfolio"
                description="View credit decisions executing in the Evaluation & Approval stage."
                icon={Briefcase}
                href="/portfolio"
                delay={0.2}
                gradientColors="from-purple-400/0 via-purple-400/40 to-purple-400/0"
                iconBgColor="bg-purple-500/10"
                iconColor="text-purple-400"
                iconBorder="border-purple-500/20"
                iconHoverShadow="rgba(168,85,247,0.3)"
                cardHoverBorder="hover:border-purple-500/40"
                cardHoverShadow="rgba(168,85,247,0.25)"
              />
            </div>
          </div>

          {/* Right Column: Info Panels */}
          <div className="lg:col-span-5 flex flex-col gap-6 h-full">
            <FlowTimeline itemVariants={itemVariants} />

            {/* Active Status Panel */}
            <motion.div 
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              className="glass-panel bg-gradient-to-br from-blue-900/20 to-slate-900/50 border border-blue-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5 hover:border-blue-500/40 transition-all duration-300 shadow-lg hover:shadow-[0_10px_30px_-10px_rgba(59,130,246,0.2)] cursor-default"
              role="alert"
              aria-live="polite"
            >
              <div className="p-3 bg-blue-500/10 rounded-xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-blue-400/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" aria-hidden="true"></div>
                <ShieldCheck className="w-10 h-10 text-blue-400 flex-shrink-0 relative z-10" aria-hidden="true" />
              </div>
              <div>
                <h4 className="text-base font-bold text-blue-100 flex items-center gap-2">
                  Capital Impact Active
                  <span className="relative flex h-3 w-3" aria-hidden="true">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                  </span>
                </h4>
                <p className="text-sm text-blue-200/70 mt-1.5 leading-relaxed">This analysis includes Basel II compliant RAROC simulation and portfolio capital impact metrics.</p>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
