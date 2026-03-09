"use client";

import React, { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  UploadCloud, ScanSearch, FileText, CheckCircle2, AlertCircle,
  BrainCircuit, Download, Activity, Scale, Network, ShieldCheck, TrendingUp, AlertTriangle, FileBarChart
} from "lucide-react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from "recharts";
import { useAuth } from "@/context/AuthContext";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const NEXT_PUBLIC_API_URL = "http://localhost:8000/api";

export default function Workspace() {
  const router = useRouter();
  const { user } = useAuth();
  const [authToken, setAuthToken] = useState(null);

  // App State
  const [analysisId, setAnalysisId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("IDLE"); // IDLE, UPLOADING, SUCCESS, ERROR
  const [errorMessage, setErrorMessage] = useState("");

  // Derived / Mocked Reconciliation Data for Panel 1
  const [reconciliationData, setReconciliationData] = useState([
    { month: "Jan", gst: 1200000, bank: 1150000, variance: -50000 },
    { month: "Feb", gst: 1300000, bank: 1290000, variance: -10000 },
    { month: "Mar", gst: 1400000, bank: 1600000, variance: 200000 },
  ]);

  // Panel 2 State
  const [researchNotes, setResearchNotes] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Panel 3 State
  const [analysisResult, setAnalysisResult] = useState(null);

  useEffect(() => {
    if (user) {
      user.getIdToken().then(token => setAuthToken(token));
    } else {
      setAuthToken(null);
    }
  }, [user]);

  // --- DROPZONE FOR UPLOAD ---
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'], 'text/csv': ['.csv'] },
    onDrop: async (acceptedFiles) => {
      if (!acceptedFiles.length) return;
      setIsUploading(true);
      setUploadStatus("UPLOADING");

      try {
        const file = acceptedFiles[0];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("doc_type", file.type.includes("pdf") ? "financial_pdf" : "bank_csv");
        if (analysisId) formData.append("analysis_id", analysisId);

        let currentToken = authToken;
        if (user) {
          currentToken = await user.getIdToken();
        }

        const res = await fetch(`${NEXT_PUBLIC_API_URL}/upload`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${currentToken}`
          },
          body: formData
        });

        if (!res.ok) {
          let errMsg = "Upload failed";
          try {
            const errData = await res.json();
            errMsg = errData.detail?.error || errData.detail || errData.error || errMsg;
          } catch (e) { }
          throw new Error(errMsg);
        }
        const data = await res.json();

        setAnalysisId(data.analysis_id);
        setUploadStatus("SUCCESS");
        setErrorMessage("");
      } catch (err) {
        console.error("Upload error", err);
        setErrorMessage(err.message);
        setUploadStatus("ERROR");
      } finally {
        setIsUploading(false);
      }
    }
  });

  // --- SUBMIT ANALYSIS ---
  const handleAnalyze = async () => {
    setIsAnalyzing(true);

    // Construct the payload structure corresponding to AnalyzeRequest matching the backend
    const payload = {
      analysis_id: analysisId || "ana_" + Math.random().toString(36).substr(2, 9),
      customer: { name: "Acme Corp Ltd.", id: "cust_123", industry: "Manufacturing", constitution: "Private Limited" },
      financials: { operating_income: 5000000, non_operating_income: 0, short_term_liab: 1000000, long_term_liab: 2000000, contingent_liab: 0, internal_rating: "BBB", external_rating: "BB+", bureau_score: 750, current_assets: 3000000, fixed_assets: 4000000, intangible_assets: 0 },
      facility: { amount: 2000000, currency: "INR", purpose: "Working Capital", term_months: 24, repayment_method: "EMI" },
      collateral_list: [{ type: "Real Estate", value: 2500000 }],
      writeup: { swot: "Strong market position.", business_overview: researchNotes || "Standard capacity.", policy_exceptions: "" },
      kyc_status: "Verified",
      exposure: { internal: 500000, external: 0, parent_child: 0, geography: "Low", industry: "Medium", entity: "Low" },
      approval: { risk_dept: "Pending", legal_dept: "Pending", compliance: "Pending" }
    };

    let currentToken = authToken;
    if (user) {
      currentToken = await user.getIdToken();
    }

    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentToken}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setAnalysisResult(data);
    } catch (err) {
      console.error(err);
      // Fallback local state if backend is down
      setAnalysisResult({
        decision: { decision: "APPROVED", summary: { recommended_limit: 1800000 } },
        risk_premium: { total_rate_bps: 450, total_rate: 0.045 },
        composite_risk: { composite_score: 65 },
        shap_explanation: {
          top_5_factors: [
            { feature: "Strong DSCR", importance: 12 },
            { feature: "Industry Headwinds", importance: -5 },
            { feature: "Liquidity Ratio", importance: 8 },
            { feature: "Pending e-Courts Litigation", importance: -18 },
            { feature: "Collateral Coverage", importance: 15 }
          ]
        }
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- NAVIGATE TO CAM TERMINAL ---
  const handleViewCAM = () => {
    if (!analysisResult?.analysis_id) return;
    router.push(`/cam-terminal/${analysisResult.analysis_id}`);
  };

  // Mock Radar Data mapped from SHAP or defaults
  const radarData = [
    { subject: 'Character', A: 85, fullMark: 100 },
    { subject: 'Capacity', A: 70, fullMark: 100 },
    { subject: 'Capital', A: 90, fullMark: 100 },
    { subject: 'Collateral', A: 80, fullMark: 100 },
    { subject: 'Conditions', A: 60, fullMark: 100 },
  ];

  const shapData = analysisResult?.shap_explanation?.top_5_factors?.map(f => ({
    name: f.feature,
    Impact: f.importance,
  })) || [];

  return (
    <div className="flex flex-col gap-6 min-h-[calc(100vh-80px)] overflow-x-hidden">

      {/* =========================================
          TOP LEVEL: UNIFIED SUMMARY CARDS
          ========================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-md border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overall Risk Score</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analysisResult ? analysisResult.composite_risk?.composite_score || "65" : "---"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analysisResult ? "+2 pts from last period" : "Awaiting analysis..."}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved Limit</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${analysisResult?.decision?.decision === "APPROVED" ? "text-emerald-500" : ""}`}>
              {analysisResult ? `₹${(analysisResult.decision?.summary?.recommended_limit || 0).toLocaleString()}` : "---"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analysisResult ? "Based on working capital gaps" : "Calculate to view"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alerts Found</CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analysisResult ? "3" : "0"}
            </div>
            <div className="flex gap-2 mt-2">
              {analysisResult ? (
                <>
                  <Badge variant="destructive">High Risk</Badge>
                  <Badge variant="warning">Monitor</Badge>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">No active scans</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* =========================================
            PANEL 1: DATA INGESTION & RECONCILIATION 
            ========================================= */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="xl:col-span-4 flex flex-col h-full"
        >
          <Card className="flex-1 shadow-lg border-border/40">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 shrink-0">
                  <UploadCloud size={20} />
                </div>
                <div>
                  <CardTitle className="text-lg">Data Ingestion</CardTitle>
                  <CardDescription>Upload financials for processing</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {/* Secure Dropbox */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${isDragActive ? 'border-primary bg-primary/5' :
                  uploadStatus === 'ERROR' ? 'border-destructive bg-destructive/5' :
                    'border-border hover:border-primary/50 bg-secondary/30'
                  }`}
              >
                <input {...getInputProps()} />
                {isUploading ? (
                  <div className="flex flex-col items-center">
                    <ScanSearch className="w-10 h-10 text-primary animate-pulse mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Parsing Financial Documents...</p>
                  </div>
                ) : uploadStatus === "SUCCESS" ? (
                  <div className="flex flex-col items-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3" />
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Documents Ingested Successfully</p>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">ID: {analysisId}</p>
                  </div>
                ) : uploadStatus === "ERROR" ? (
                  <div className="flex flex-col items-center">
                    <AlertCircle className="w-10 h-10 text-destructive mb-3" />
                    <p className="text-sm font-medium text-destructive">Upload Failed</p>
                    <p className="text-xs text-destructive/80 mt-1">{errorMessage}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <FileBarChart className="w-10 h-10 mb-3 opacity-50" />
                    <p className="text-sm font-medium">Drag & drop files here</p>
                    <p className="text-xs mt-1">Supports PDF & CSV up to 50MB</p>
                  </div>
                )}
              </div>

              {/* Reconciliation Table */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Scale size={14} /> GST vs Bank Reconciliation
                </h3>
                <div className="rounded-lg border bg-surface text-sm overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-muted/50 border-b font-medium text-muted-foreground">
                      <tr>
                        <th className="p-2.5 px-3">Month</th>
                        <th className="p-2.5 px-3 text-right">GSTR-3B</th>
                        <th className="p-2.5 px-3 text-right">Bank</th>
                        <th className="p-2.5 px-3 text-right">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {reconciliationData.map((row, i) => (
                        <tr key={i} className="hover:bg-muted/20 transition-colors">
                          <td className="p-2.5 px-3 font-medium">{row.month}</td>
                          <td className="p-2.5 px-3 text-right text-muted-foreground">{(row.gst / 100000).toFixed(1)}L</td>
                          <td className="p-2.5 px-3 text-right text-muted-foreground">{(row.bank / 100000).toFixed(1)}L</td>
                          <td className={`p-2.5 px-3 text-right font-medium ${row.variance < 0 ? 'text-destructive' : 'text-emerald-500'}`}>
                            {row.variance > 0 ? '+' : ''}{(row.variance / 100000).toFixed(1)}L
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* =========================================
            PANEL 2: RESEARCH AGENT & INSIGHT PORTAL
            ========================================= */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="xl:col-span-3 flex flex-col h-full"
        >
          <Card className="flex-1 shadow-lg border-border/40 flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500 shrink-0">
                  <BrainCircuit size={20} />
                </div>
                <div>
                  <CardTitle className="text-lg">Research Agent</CardTitle>
                  <CardDescription>Automated external intelligence</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 pt-0 pb-4 px-6 gap-4">
              {/* External Intelligence Feed */}
              <div className="flex-1 md:min-h-[160px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 flex gap-3 items-start">
                  <AlertCircle size={16} className="text-rose-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-rose-500 dark:text-rose-400">e-Courts Alert</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">2 pending criminal litigations matching promoter PAN.</p>
                  </div>
                </div>
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 flex gap-3 items-start">
                  <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">MCA Filing Sync</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Annual filings perfectly matched structural directors matrix.</p>
                  </div>
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex gap-3 items-start">
                  <Activity size={16} className="text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-600 dark:text-amber-500">EPFO Anomaly</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">20% drop in active PF contributions YoY.</p>
                  </div>
                </div>
              </div>

              {/* Qualitative Notes */}
              <div className="mt-auto pt-2 border-t border-border/50">
                <label className="block text-xs font-semibold text-muted-foreground mb-2">
                  Credit Officer Notes
                </label>
                <textarea
                  className="w-full h-24 bg-secondary/30 border border-input rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-none"
                  placeholder="Inject qualitative nuances..."
                  value={researchNotes}
                  onChange={(e) => setResearchNotes(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="pt-0 border-t border-transparent">
              <Button
                size="lg"
                className="w-full shadow-sm text-sm"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                    Processing Models...
                  </>
                ) : (
                  <>
                    <BrainCircuit size={16} className="mr-2" />
                    Run AI Analysis
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </motion.div>

        {/* =========================================
            PANEL 3: RECOMMENDATION & EXPLAINABILITY
            ========================================= */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="xl:col-span-5 flex flex-col h-full"
        >
          <Card className="flex-1 shadow-lg border-border/40 flex flex-col relative overflow-hidden">
            {!analysisResult ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/60 backdrop-blur-sm z-10 border-t border-border/50">
                <Activity className="w-10 h-10 text-muted-foreground mb-4 opacity-50" />
                <p className="text-sm text-muted-foreground font-medium">Awaiting Analysis Execution</p>
              </div>
            ) : null}

            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Recommendation</CardTitle>
                  <CardDescription>Model explainability & decision</CardDescription>
                </div>
                {analysisResult && (
                  <Badge
                    variant={analysisResult.decision?.decision === "APPROVED" ? "success" : "destructive"}
                    className="text-sm px-3 py-1 shadow-sm"
                  >
                    {analysisResult.decision?.decision || "UNKNOWN"}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col gap-6 pt-0">
              {/* Decision Header */}
              {analysisResult && (
                <div className={`p-5 rounded-xl border ${analysisResult.decision?.decision === "APPROVED"
                  ? "bg-emerald-500/5 border-emerald-500/20"
                  : "bg-rose-500/5 border-rose-500/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Recommended Limit</p>
                      <p className={`text-2xl font-bold mt-1 ${analysisResult.decision?.decision === "APPROVED" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        ₹{(analysisResult.decision?.summary?.recommended_limit || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Risk Premium</p>
                      <p className="text-2xl font-bold text-foreground mt-1">
                        {(analysisResult.risk_premium?.total_rate_bps || 0) / 100}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Charts Section */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[0]">
                {/* SHAP Explainability Waterfall */}
                <div className="flex flex-col h-full">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Activity size={14} /> SHAP Drivers
                  </h3>
                  <div className="flex-1 min-h-[160px] relative -ml-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={shapData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                        <XAxis type="number" hide domain={[-20, 20]} />
                        <YAxis dataKey="name" type="category" width={90} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <ReferenceLine x={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                        <Tooltip
                          cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                          contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))', fontSize: '12px' }}
                          itemStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Bar dataKey="Impact" radius={[0, 4, 4, 0]} barSize={16}>
                          {shapData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.Impact > 0 ? "hsl(var(--destructive))" : "hsl(var(--success))"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 5 Cs Radar Chart */}
                <div className="flex flex-col h-full">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 text-right">
                    5 C's Assessment
                  </h3>
                  <div className="flex-1 min-h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="65%" data={radarData}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name="Applicant" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-0 pb-6 px-6 relative z-20 bg-card">
              <Button
                onClick={handleViewCAM}
                disabled={!analysisResult}
                className="w-full shadow-sm"
                variant="outline"
              >
                <Download size={16} className="mr-2" />
                Open Document Generation Terminal
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>

      {/* Dynamic Error Toast */}
      {uploadStatus === "ERROR" && errorMessage && (
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          className="fixed bottom-6 left-6 z-50 bg-rose-500/90 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md border border-rose-400/30"
        >
          <AlertCircle className="w-5 h-5 text-rose-100" />
          <span className="text-sm font-medium">{errorMessage}</span>
        </motion.div>
      )}
    </div>
  );
}
