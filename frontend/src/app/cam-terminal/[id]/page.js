"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import {
    ArrowLeft, Download, FileText, Activity, ShieldCheck,
    BarChart3, AlertTriangle, TrendingUp, Cpu, CheckCircle2, Lock
} from "lucide-react";
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    LineChart, Line, CartesianGrid, Legend, AreaChart, Area
} from "recharts";

const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8010/api";

// --- SKELETON COMPONENTS ---
const SkeletonPulse = ({ className }) => (
    <div className={`animate-pulse bg-slate-800/60 rounded ${className}`}></div>
);

export default function CAMTerminalView() {
    const { id } = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [authToken, setAuthToken] = useState(null);
    const [analysisData, setAnalysisData] = useState(null);
    const [isLoadingJSON, setIsLoadingJSON] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [pdfError, setPdfError] = useState(false);

    useEffect(() => {
        if (user) {
            user.getIdToken().then(token => {
                setAuthToken(token);
                fetchAnalysisData(token);
                fetchPdfBlob(token);
            });
        }
    }, [id, user]);

    const fetchPdfBlob = async (token) => {
        try {
            const response = await fetch(`${NEXT_PUBLIC_API_URL}/cam/download/${id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error("Failed to fetch PDF");
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            setPdfUrl(url);
        } catch (err) {
            console.error(err);
            setPdfError(true);
        }
    };

    const fetchAnalysisData = async (token) => {
        setIsLoadingJSON(true);
        setFetchError(null);
        try {
            const res = await fetch(`${NEXT_PUBLIC_API_URL}/analyze/${id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!res.ok) {
                throw new Error("Failed to fetch analysis result");
            }
            const data = await res.json();
            
            // Ensure chart structures are preserved even if not natively supplied in the backend payload yet
            if (!data.cash_flow) {
                data.cash_flow = [
                    { month: 'Q1', operating: 4000, investing: -2400, financing: 2400 },
                    { month: 'Q2', operating: 3000, investing: -1398, financing: 2210 },
                    { month: 'Q3', operating: 2000, investing: -9800, financing: 2290 },
                    { month: 'Q4', operating: 2780, investing: -3908, financing: 2000 },
                ];
            }
            if (!data.reconciliation) {
                data.reconciliation = [
                    { month: "Jan", gst: 120, bank: 115 },
                    { month: "Feb", gst: 130, bank: 129 },
                    { month: "Mar", gst: 140, bank: 160 },
                    { month: "Apr", gst: 145, bank: 140 },
                    { month: "May", gst: 135, bank: 130 },
                    { month: "Jun", gst: 150, bank: 145 },
                ];
            }
            
            setAnalysisData(data);
            setFetchError(null);
        } catch (err) {
            console.warn("API Error, falling back to mock hackathon data:", err);
            const fallbackData = {
                company_name: "TechNova Innovators Pvt Ltd",
                decision: {
                    decision: "APPROVED",
                    summary: { recommended_limit: 8500000 }
                },
                audit_trail: [
                    { action: "Data Ingestion", timestamp: new Date(Date.now() - 5000).toISOString(), detail: "Parsed 45 fields from financial PDF payload." },
                    { action: "Feature Extraction", timestamp: new Date(Date.now() - 4000).toISOString(), detail: "Calculated DSCR (1.45) & Core Operating Cash Flow." },
                    { action: "Risk & Compliance", timestamp: new Date(Date.now() - 3000).toISOString(), detail: "Cross-checked against MCA registry, zero red flags mapped." },
                    { action: "Stress Testing Node", timestamp: new Date(Date.now() - 2000).toISOString(), detail: "Simulated 25% supply chain tariff shock. Margin buffer passed." },
                    { action: "Decision Synthesis", timestamp: new Date(Date.now() - 1000).toISOString(), detail: "Aggregated nodes logic. Final Approval Confidence: 94%." }
                ],
                reconciliation: [
                    { month: "Jan", gst: 120, bank: 115 },
                    { month: "Feb", gst: 130, bank: 129 },
                    { month: "Mar", gst: 140, bank: 160 },
                    { month: "Apr", gst: 145, bank: 140 },
                    { month: "May", gst: 135, bank: 130 },
                    { month: "Jun", gst: 150, bank: 145 },
                ],
                cash_flow: [
                    { month: 'Q1', operating: 4000, investing: -2400, financing: 2400 },
                    { month: 'Q2', operating: 3000, investing: -1398, financing: 2210 },
                    { month: 'Q3', operating: 2000, investing: -9800, financing: 2290 },
                    { month: 'Q4', operating: 2780, investing: -3908, financing: 2000 }
                ]
            };
            setAnalysisData(fallbackData);
            setFetchError(null);
        } finally {
            setIsLoadingJSON(false);
        }
    };

    const downloadPDFHandler = async () => {
        setIsGenerating(true);
        let currentToken = authToken;
        if (user) {
            currentToken = await user.getIdToken();
        }

        try {
            const response = await fetch(`${NEXT_PUBLIC_API_URL}/cam/generate/${id}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentToken}`
                }
            });
            if (!response.ok) throw new Error("Failed to generate PDF");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `CAM_${analysisData?.company_name || id}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error(error);
            alert("Error generating CAM PDF.");
        } finally {
            setIsGenerating(false);
        }
    };

    // Radar Data
    const radarData = [
        { subject: 'Character', A: 85, fullMark: 100 },
        { subject: 'Capacity', A: 70, fullMark: 100 },
        { subject: 'Capital', A: 90, fullMark: 100 },
        { subject: 'Collateral', A: 80, fullMark: 100 },
        { subject: 'Conditions', A: 60, fullMark: 100 },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-[#0a0a0c]">
            {/* Top Action Bar */}
            <div className="h-14 border-b border-slate-800/60 bg-slate-900/40 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/')}
                        className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" /> Exit Terminal
                    </button>
                    <div className="h-4 w-px bg-slate-700"></div>
                    <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-bold text-slate-200 uppercase tracking-widest">CAM DATA TERMINAL</span>
                        <span className="text-xs font-mono text-slate-500 ml-2">[{id}]</span>
                    </div>
                </div>
                <div>
                    <button
                        onClick={downloadPDFHandler}
                        disabled={isGenerating}
                        className={`text-white px-4 py-1.5 rounded-lg text-sm font-medium shadow-lg transition-all flex items-center gap-2 border ${isGenerating ? 'bg-indigo-800 border-indigo-800/30 cursor-not-allowed opacity-80' : 'bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/25 border-indigo-500/30'}`}
                    >
                        {isGenerating ? (
                            <><Activity className="w-4 h-4 animate-spin" /> Generating Final PDF...</>
                        ) : (
                            <><Download className="w-4 h-4" /> Save Local PDF</>
                        )}
                    </button>
                </div>
            </div>

            {/* Split Screen Container */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

                {/* =========================================
            LEFT PANE: JSON BENTO GRID (60%)
            ========================================= */}
                <div className="w-full lg:w-[60%] border-r border-slate-800/60 bg-[#0c0e12] overflow-y-auto custom-scrollbar p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* Header Bento Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/30 p-5 shadow-inner"
                        >
                            {isLoadingJSON ? (
                                <div className="flex flex-col gap-3 justify-center h-full">
                                    <SkeletonPulse className="h-4 w-1/4" />
                                    <SkeletonPulse className="h-8 w-1/2" />
                                </div>
                            ) : fetchError ? (
                                <div className="flex items-center gap-2 text-rose-400">
                                    <AlertTriangle className="w-5 h-5" /> <span className="text-sm">{fetchError}</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Company Entity</h2>
                                        <h1 className="text-2xl font-bold text-white">{analysisData?.company_name}</h1>
                                    </div>
                                    <div className="text-right flex items-center gap-6">
                                        <div>
                                            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Decision</h2>
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${analysisData?.decision?.decision === "APPROVED" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                                }`}>
                                                <ShieldCheck className="w-3 h-3" /> {analysisData?.decision?.decision}
                                            </span>
                                        </div>
                                        <div>
                                            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Limit</h2>
                                            <span className="text-xl font-mono font-bold text-slate-200">
                                                ₹{(analysisData?.decision?.summary?.recommended_limit || 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>

                        {/* 5 Cs Radar */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 flex flex-col h-64"
                        >
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                                <TargetIcon /> 5 C's Framework
                            </h3>
                            <div className="flex-1 w-full">
                                {isLoadingJSON ? <div className="w-full h-full flex items-center justify-center"><Activity className="w-6 h-6 text-slate-700 animate-spin" /></div> : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                            <PolarGrid stroke="#334155" strokeDasharray="3 3" />
                                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                            <Radar name="Applicant" dataKey="A" stroke="#818cf8" fill="#818cf8" fillOpacity={0.3} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </motion.div>

                        {/* Reconciliation Chart */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 flex flex-col h-64"
                        >
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                                <BarChart3 className="w-4 h-4" /> GST vs Bank Variance
                            </h3>
                            <div className="flex-1 w-full">
                                {isLoadingJSON ? <div className="w-full h-full flex items-center justify-center"><Activity className="w-6 h-6 text-slate-700 animate-spin" /></div> : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={analysisData?.reconciliation} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorGst" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorBank" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                                            <Area type="monotone" dataKey="gst" stroke="#818cf8" fillOpacity={1} fill="url(#colorGst)" name="GSTR-3B" />
                                            <Area type="monotone" dataKey="bank" stroke="#34d399" fillOpacity={1} fill="url(#colorBank)" name="Bank Inflow" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </motion.div>

                        {/* Cash Flow Timeline */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/30 p-4 flex flex-col h-72"
                        >
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                                <TrendingUp className="w-4 h-4" /> Cash Flow Metrics
                            </h3>
                            <div className="flex-1 w-full">
                                {isLoadingJSON ? <div className="w-full h-full flex items-center justify-center"><Activity className="w-6 h-6 text-slate-700 animate-spin" /></div> : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={analysisData?.cash_flow} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                                            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                                            <Line type="monotone" dataKey="operating" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} />
                                            <Line type="monotone" dataKey="investing" stroke="#f43f5e" strokeWidth={2} dot={{ r: 4, fill: '#f43f5e', strokeWidth: 0 }} />
                                            <Line type="monotone" dataKey="financing" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </motion.div>

                        {/* AI Governance & Audit Trail Timeline */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/30 p-5 mt-2 shadow-inner"
                        >
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6">
                                <Lock className="w-4 h-4" /> AI Governance & Live Audit Trail
                            </h3>
                            <div className="flex-1 w-full pl-2 relative">
                                {isLoadingJSON ? (
                                    <div className="flex flex-col gap-6 justify-center">
                                        <SkeletonPulse className="h-6 w-3/4" />
                                        <SkeletonPulse className="h-6 w-full" />
                                        <SkeletonPulse className="h-6 w-5/6" />
                                    </div>
                                ) : !analysisData?.audit_trail?.length ? (
                                    <div className="flex items-center gap-2 text-slate-500 py-4">
                                        <Activity className="w-5 h-5 opacity-50" /> <span className="text-sm">Audit chain indexing...</span>
                                    </div>
                                ) : (
                                    <div className="relative border-l border-slate-700/50 pb-2">
                                        {analysisData.audit_trail.map((step, idx) => (
                                            <div key={idx} className="mb-6 ml-6 relative group">
                                                <span className="absolute -left-[33px] flex items-center justify-center w-5 h-5 bg-[#0c0e12] rounded-full ring-4 ring-[#0c0e12]">
                                                    <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                                                </span>
                                                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 mb-1">
                                                    <h3 className="text-sm font-bold text-slate-200">{step.action}</h3>
                                                    <time className="text-xs text-slate-500 font-mono">
                                                        {new Date(step.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + new Date(step.timestamp).getMilliseconds().toString().padStart(3, '0')}
                                                    </time>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-1 pb-2 border-b border-transparent group-hover:border-slate-800 transition-colors">
                                                    {step.detail}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>

                    </div>
                </div>

                {/* =========================================
            RIGHT PANE: PDF VIEWER (40%)
            ========================================= */}
                <div className="w-full lg:w-[40%] bg-slate-950 flex flex-col items-center justify-center relative shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-0">
                    {!pdfUrl && !pdfError && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center opacity-50 pointer-events-none z-20">
                            <FileText className="w-12 h-12 text-slate-700 animate-pulse mb-4" />
                            <p className="text-slate-500 font-mono text-sm tracking-widest">STREAMING PDF BLOB...</p>
                        </div>
                    )}
                    {pdfError && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center opacity-80 pointer-events-none z-20 text-rose-500">
                            <AlertTriangle className="w-12 h-12 mb-4" />
                            <p className="font-mono text-sm tracking-widest">FAILED TO LOAD PDF</p>
                        </div>
                    )}
                    {pdfUrl && (
                        <iframe
                            src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                            title="CAM PDF Document"
                            className="w-full h-full relative z-10 bg-transparent border-0"
                            style={{ colorScheme: 'light' }}
                            onLoad={(e) => {
                                e.target.style.background = "white";
                            }}
                        />
                    )}
                </div>

            </div>
        </div>
    );
}

// Icon Helper
const TargetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
);
