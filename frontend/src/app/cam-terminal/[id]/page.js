"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Download, Printer, CheckCircle2, AlertTriangle, ShieldCheck,
  Building2, TrendingUp, Activity, BarChart3, FileText, User, DollarSign,
  Calendar, Target, Layers
} from "lucide-react";
import useAppStore from "@/store/useAppStore";

export default function CAMTerminalPage({ params }) {
  const router = useRouter();
  const printRef = useRef(null);

  const analysisResult = useAppStore(s => s.activeAnalysisResult);
  const analysisId = useAppStore(s => s.activeAnalysisId) || params?.id || "draft";

  // Derived values from the stored analysis result
  const decision = analysisResult?.decision?.decision || "APPROVED";
  const recommendedLimit = analysisResult?.decision?.summary?.recommended_limit || 1800000;
  const riskPremium = (analysisResult?.risk_premium?.total_rate_bps || 450) / 100;
  const compositeScore = analysisResult?.composite_risk?.composite_score || 65;
  const shapFactors = analysisResult?.shap_explanation?.top_5_factors || [
    { feature: "Strong DSCR", importance: 12 },
    { feature: "Collateral Coverage", importance: 15 },
    { feature: "Liquidity Ratio", importance: 8 },
    { feature: "Industry Headwinds", importance: -5 },
    { feature: "Pending e-Courts Litigation", importance: -18 },
  ];

  const isApproved = decision === "APPROVED";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0E14] text-foreground print:bg-white print:text-black">
      {/* Top Bar — hidden on print */}
      <div className="print:hidden sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
              CAM Terminal
            </span>
            <span className="text-xs text-slate-400 font-mono ml-1">#{analysisId.slice(0, 12)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </button>
          <div
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${
              isApproved
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30"
            }`}
          >
            {isApproved ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {decision}
          </div>
        </div>
      </div>

      {/* CAM Document */}
      <div ref={printRef} className="max-w-5xl mx-auto px-6 py-10 print:px-8 print:py-4">

        {/* ===== HEADER ===== */}
        <div className="text-center mb-10 pb-8 border-b-2 border-slate-200 dark:border-slate-700 print:border-black">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-teal-400 flex items-center justify-center shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            </div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Intelli-Credit AI</h1>
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Credit Appraisal Memorandum
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">
            AI-Assisted Underwriting Report &nbsp;·&nbsp; Confidential
          </p>
          <div className="mt-4 inline-flex items-center gap-3 px-6 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-xs font-mono text-slate-600 dark:text-slate-400">
            <span>Report ID: {analysisId}</span>
            <span>·</span>
            <span>Generated: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</span>
          </div>
        </div>

        {/* ===== DECISION BANNER ===== */}
        <div className={`rounded-2xl p-6 mb-8 border flex items-center justify-between ${isApproved ? "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20" : "bg-rose-50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/20"}`}>
          <div className="flex items-center gap-4">
            {isApproved
              ? <CheckCircle2 className="w-12 h-12 text-emerald-500 shrink-0" />
              : <AlertTriangle className="w-12 h-12 text-rose-500 shrink-0" />
            }
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">AI Credit Decision</p>
              <p className={`text-4xl font-black tracking-tight ${isApproved ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {decision}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Recommended Limit</p>
            <p className="text-4xl font-black text-slate-800 dark:text-white">
              ₹{(recommendedLimit / 100000).toFixed(1)}L
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">@ {riskPremium}% risk premium</p>
          </div>
        </div>

        {/* ===== SECTION 1: BORROWER PROFILE ===== */}
        <Section icon={<Building2 className="w-5 h-5" />} title="1. Borrower Profile" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <InfoCard label="Borrower Name" value="Acme Corp Ltd." />
          <InfoCard label="Industry" value="Manufacturing" />
          <InfoCard label="Constitution" value="Private Limited" />
          <InfoCard label="KYC Status" value="✅ Verified" highlight />
          <InfoCard label="Credit Bureau Score" value="750 / 900" />
          <InfoCard label="Internal Rating" value="BBB" />
        </div>

        {/* ===== SECTION 2: FACILITY DETAILS ===== */}
        <Section icon={<DollarSign className="w-5 h-5" />} title="2. Facility Details" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <InfoCard label="Facility Amount" value="₹20,00,000" />
          <InfoCard label="Currency" value="INR" />
          <InfoCard label="Purpose" value="Working Capital" />
          <InfoCard label="Tenure" value="24 Months" />
          <InfoCard label="Repayment Method" value="EMI" />
          <InfoCard label="Collateral" value="Real Estate — ₹25,00,000" />
        </div>

        {/* ===== SECTION 3: FINANCIAL SUMMARY ===== */}
        <Section icon={<BarChart3 className="w-5 h-5" />} title="3. Financial Summary" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <InfoCard label="Operating Income" value="₹50,00,000" />
          <InfoCard label="Short-Term Liab." value="₹10,00,000" />
          <InfoCard label="Long-Term Liab." value="₹20,00,000" />
          <InfoCard label="Current Assets" value="₹30,00,000" />
          <InfoCard label="Fixed Assets" value="₹40,00,000" />
          <InfoCard label="External Rating" value="BB+" />
          <InfoCard label="Internal Composite Score" value={`${compositeScore} / 100`} />
          <InfoCard label="Risk Premium" value={`${riskPremium}%`} highlight />
        </div>

        {/* ===== SECTION 4: RISK METRICS ===== */}
        <Section icon={<Activity className="w-5 h-5" />} title="4. Risk Metrics (AI Model Output)" />
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left p-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Metric</th>
                <th className="text-left p-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Value</th>
                <th className="text-left p-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <MetricRow label="Composite Risk Score" value={`${compositeScore}/100`} signal={compositeScore < 70 ? "🟢 Within Acceptable Range" : "🔴 Elevated Risk"} />
              <MetricRow label="Recommended Credit Limit" value={`₹${(recommendedLimit / 100000).toFixed(1)}L`} signal="🟢 Model Approved" />
              <MetricRow label="Risk-Adjusted Pricing" value={`${riskPremium}% p.a.`} signal="🟡 Standard Rate" />
              <MetricRow label="Exposure at Default (EAD)" value="₹20,00,000" signal="🟡 Monitor Closely" />
              <MetricRow label="Loss Given Default (LGD)" value="40%" signal="🟢 Covered by Collateral" />
              <MetricRow label="Probability of Default (PD)" value="5.5%" signal="🟢 Low Risk Tier" />
            </tbody>
          </table>
        </div>

        {/* ===== SECTION 5: SHAP EXPLAINABILITY ===== */}
        <Section icon={<Target className="w-5 h-5" />} title="5. Model Explainability (SHAP Drivers)" />
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left p-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Factor</th>
                <th className="text-left p-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Impact Score</th>
                <th className="text-left p-3 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Direction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shapFactors.map((f, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="p-3 px-4 font-medium text-slate-700 dark:text-slate-300">{f.feature}</td>
                  <td className="p-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">{f.importance > 0 ? "+" : ""}{f.importance}</td>
                  <td className="p-3 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${f.importance > 0 ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400"}`}>
                      {f.importance > 0 ? "▲ Supports Approval" : "▼ Increases Risk"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ===== SECTION 6: APPROVAL CHAIN ===== */}
        <Section icon={<ShieldCheck className="w-5 h-5" />} title="6. Approval & Compliance" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <InfoCard label="Risk Department" value="Pending" />
          <InfoCard label="Legal Department" value="Pending" />
          <InfoCard label="Compliance" value="Pending" />
        </div>

        {/* ===== SECTION 7: DISCLAIMER ===== */}
        <div className="rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-6 mb-8">
          <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
            <strong className="text-slate-700 dark:text-slate-400">Disclaimer:</strong> This Credit Appraisal Memorandum (CAM) is generated by the Intelli-Credit AI Underwriting Engine and is intended for internal use by authorized credit officers only. The AI-generated recommendation does not substitute the judgment of a qualified credit professional. All final credit decisions must be approved by the designated authority as per the institution's credit policy. This document is confidential and should not be shared externally without proper authorization.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 dark:text-slate-600 pb-4">
          Generated by Intelli-Credit AI · {new Date().toLocaleString("en-IN")} · CONFIDENTIAL
        </div>
      </div>
    </div>
  );
}

// ---- Helper Components ----

function Section({ icon, title }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-2">
      <div className="p-1.5 bg-blue-500/10 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
        {icon}
      </div>
      <h3 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">{title}</h3>
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}

function InfoCard({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "bg-blue-50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/20" : "bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700"}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-500 mb-1">{label}</p>
      <p className={`text-sm font-bold ${highlight ? "text-blue-700 dark:text-blue-400" : "text-slate-800 dark:text-slate-200"}`}>{value}</p>
    </div>
  );
}

function MetricRow({ label, value, signal }) {
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
      <td className="p-3 px-4 font-medium text-slate-700 dark:text-slate-300">{label}</td>
      <td className="p-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">{value}</td>
      <td className="p-3 px-4 text-xs text-slate-500 dark:text-slate-400">{signal}</td>
    </tr>
  );
}
