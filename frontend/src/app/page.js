"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileText, Database, Activity, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { uploadDocument, runAnalysis } from "@/lib/api";

const INDUSTRIES = [
  "Manufacturing", "IT Services", "Healthcare", "Real Estate",
  "Retail", "Energy", "Agriculture", "Financial Services",
  "Telecom", "Construction", "Pharmaceuticals", "Automotive"
];

export default function Home() {
  const router = useRouter();

  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const [formData, setFormData] = useState({
    company_name: "",
    industry: "Manufacturing",
    loan_amount_requested: 5000000,
    collateral_value: 3000000,
    bureau_score: 720,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "company_name" || name === "industry" ? value : Number(value),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      alert("Please upload a financial statement PDF.");
      return;
    }

    setIsLoading(true);

    try {
      setLoadingStep("Extracting text and tables from PDF via OCR...");
      const uploadRes = await uploadDocument(file, "financial_pdf");
      const analysisId = uploadRes.analysis_id;

      setLoadingStep("Computing financial ratios and simulating web research...");
      await new Promise(r => setTimeout(r, 1500)); // Demo Artificial Delay for UI effect

      setLoadingStep("Running ML PD, limit, and risk premium models...");
      await new Promise(r => setTimeout(r, 1200));

      setLoadingStep("Synthesizing composite risk score & testing stress constraints...");
      const result = await runAnalysis(analysisId, formData);

      // Store in session storage to pass to the next page
      sessionStorage.setItem("analysisResult", JSON.stringify(result));
      sessionStorage.setItem("analysisId", analysisId);

      setLoadingStep("Generating final decisions and capital impact...");
      await new Promise(r => setTimeout(r, 500));

      router.push("/analyze");

    } catch (err) {
      console.error(err);
      alert("Error processing application. " + (err.response?.data?.detail || err.message));
      setIsLoading(false);
      setLoadingStep("");
    }
  };

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
        {/* Left Column: Form */}
        <div className="lg:col-span-7 glass-card rounded-2xl p-8 border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-500 opacity-80" />

          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
            <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Database className="w-5 h-5" />
            </span>
            New Credit Proposal
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* File Upload Drag & Drop */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">1. Upload Financials (PDF)</label>
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ease-out cursor-pointer group-hover:border-blue-500/50 relative overflow-hidden
                  ${isDragging ? 'border-blue-400 bg-blue-500/10' : 'border-slate-700 hover:bg-slate-800/40'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0])}
                />

                <div className="flex flex-col items-center justify-center gap-3 pointer-events-none">
                  {file ? (
                    <>
                      <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-emerald-400">{file.name}</p>
                        <p className="text-sm text-slate-400 mt-1">Ready for parsing</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors 
                        ${isDragging ? 'bg-blue-500/30' : 'bg-slate-800 border border-slate-700 shadow-inner'}`}>
                        <UploadCloud className={`w-6 h-6 ${isDragging ? 'text-blue-400' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <p className="text-base font-medium text-white mb-1">Drag & drop your financial statement</p>
                        <p className="text-sm text-slate-400">PDFs containing balance sheet, income, and cash flow</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800/80">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Company Name</label>
                <input
                  type="text" name="company_name" required
                  value={formData.company_name} onChange={handleChange}
                  className="w-full bg-[#0d1117] border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow"
                  placeholder="e.g. Acme Corp"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Industry Sector</label>
                <select
                  name="industry" value={formData.industry} onChange={handleChange}
                  className="w-full bg-[#0d1117] border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 appearance-none"
                >
                  {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Loan Amount Requested (USD)</label>
                <input
                  type="number" name="loan_amount_requested" required
                  value={formData.loan_amount_requested} onChange={handleChange}
                  className="w-full bg-[#0d1117] border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Collateral Value Offered (USD)</label>
                <input
                  type="number" name="collateral_value" required
                  value={formData.collateral_value} onChange={handleChange}
                  className="w-full bg-[#0d1117] border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-400">Bureau Score (Simulation Default)</label>
                <input
                  type="number" name="bureau_score"
                  value={formData.bureau_score} onChange={handleChange}
                  className="w-full bg-[#0d1117] border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !file || !formData.company_name}
              className={`w-full mt-6 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all
                ${isLoading || !file || !formData.company_name
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 relative overflow-hidden group'}`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Credit Intelligence...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  Run Autonomous Analysis
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Loading State / Info */}
        <div className="lg:col-span-5 h-full">
          {isLoading ? (
            <div className="h-full min-h-[400px] glass-card rounded-2xl p-8 flex flex-col justify-center items-center text-center border border-blue-500/20 relative">
              <div className="absolute inset-0 bg-blue-500/5 animate-pulse rounded-2xl" />
              <div className="relative w-24 h-24 mb-8">
                <div className="absolute inset-0 border-4 border-slate-800 rounded-full" />
                <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin" />
                <div className="absolute inset-2 border-4 border-teal-500/50 rounded-full border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">AI Credit Officer Processing</h3>
              <p className="text-blue-400 font-mono text-sm h-8 animate-pulse mb-6">{loadingStep}</p>

              <div className="w-full space-y-3 mt-4">
                {/* Progress dots simulating pipeline steps */}
                {[
                  { label: "Document AI Pipeline", active: loadingStep.includes("Extracting") },
                  { label: "Feature Store & Web Scraping", active: loadingStep.includes("Computing") },
                  { label: "Gradient Boosting Inference", active: loadingStep.includes("Running") },
                  { label: "Stress Testing Engine", active: loadingStep.includes("Synthesizing") },
                ].map((step, idx) => (
                  <div key={idx} className="flex items-center text-left text-sm">
                    <div className={`w-2 h-2 rounded-full mr-3 ${step.active ? 'bg-blue-500 animate-ping' : 'bg-slate-700'}`} />
                    <span className={step.active ? 'text-white font-medium' : 'text-slate-500'}>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
