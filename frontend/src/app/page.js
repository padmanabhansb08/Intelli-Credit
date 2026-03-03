"use client";

import { useRouter } from "next/navigation";
import {
  Building2, Database, Activity, ShieldCheck,
  ArrowRight, FileText, Briefcase, PlusCircle
} from "lucide-react";

export default function Home() {
  const router = useRouter();

  return (
    <div className="max-w-7xl mx-auto py-12">
      <div className="text-center mb-16 space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700/50 text-sm font-medium text-slate-300">
          <Activity className="w-4 h-4 text-blue-400" />
          Autonomous AI Credit Officer
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-slate-400 pb-2">
          Intelligent Corporate Underwriting
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto font-light">
          Upload financials to trigger end-to-end ML credit scoring, automated web-scale diligence, scenario simulation, and structured CAM generation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-card rounded-2xl p-8 border border-white/5 relative overflow-hidden group hover:border-blue-500/30 transition-all cursor-pointer"
            onClick={() => router.push('/studio')}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-500 opacity-80" />

            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold mb-2 flex items-center gap-3 text-white">
                  <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <Activity className="w-6 h-6" />
                  </span>
                  Decision Engine Studio
                </h2>
                <p className="text-slate-300 ml-14">Enter the interactive Canvas Studio. Visually design, deploy, and backtest complex credit decisioning graphs using drag-and-drop integration nodes.</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-emerald-600 transition-colors shadow-lg">
                <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card rounded-2xl p-6 border border-slate-700/50 hover:border-slate-500 transition-all cursor-pointer"
              onClick={() => router.push('/proposal/new')}>
              <PlusCircle className="w-8 h-8 text-blue-500 mb-4" />
              <h3 className="text-lg font-bold text-white mb-1">Manual Proposal</h3>
              <p className="text-sm text-slate-400">Initiate a classic step-by-step credit origination data entry form.</p>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-slate-700/50 hover:border-slate-500 transition-all cursor-pointer"
              onClick={() => router.push('/portfolio')}>
              <Briefcase className="w-8 h-8 text-purple-500 mb-4" />
              <h3 className="text-lg font-bold text-white mb-1">Active Portfolio</h3>
              <p className="text-sm text-slate-400">View credit decisions executing in the Evaluation & Approval stage.</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 h-full">
          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Activity className="w-24 h-24" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Automated Underwriting Flow</h3>
              <ul className="space-y-4 mt-6 text-sm text-slate-400">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-xs font-mono border border-slate-700">1</span>
                  <span><strong className="text-slate-200 font-medium">Data Ingestion:</strong> Extract structured ratios from PDFs via OCR fallback pipelines.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-xs font-mono border border-slate-700">2</span>
                  <span><strong className="text-slate-200 font-medium">Risk Modeling:</strong> Calculate PD and recommended exposure using Scikit-Learn tree ensembles.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-xs font-mono border border-slate-700">3</span>
                  <span><strong className="text-slate-200 font-medium">Web Intelligence:</strong> Simulates NLP sentiment analysis for ESG and litigation flags.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-xs font-mono border border-slate-700">4</span>
                  <span><strong className="text-slate-200 font-medium">Explainable Decisions:</strong> Outputs SHAP value importance alongside a fully formatted CAM PDF.</span>
                </li>
              </ul>
            </div>

            <div className="glass-panel bg-blue-900/10 border-blue-500/20 rounded-2xl p-6 flex items-center gap-4">
              <ShieldCheck className="w-10 h-10 text-blue-400 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-blue-100">Capital Impact Active</h4>
                <p className="text-xs text-blue-300 mt-1">This analysis includes Basel II compliant RAROC simulation and portfolio capital impact metrics.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
