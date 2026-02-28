"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ShieldCheck, PieChart as PieChartIcon, Search, FileText, ArrowUpRight } from "lucide-react";
import { getAnalyses, getDrafts } from "@/lib/api";

export default function PortfolioPage() {
    const router = useRouter();
    const [analyses, setAnalyses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const fetchPortfolio = async () => {
            try {
                // Fetch both completed CAMs and in-progress Drafts
                const [completedData, draftsData] = await Promise.all([
                    getAnalyses(),
                    getDrafts()
                ]);

                const combined = [
                    ...(Array.isArray(completedData) ? completedData : []),
                    ...(Array.isArray(draftsData?.drafts) ? draftsData.drafts : []) // Extract 'drafts' array from response
                ];
                setAnalyses(combined);
            } catch (err) {
                console.error("Failed to load portfolio:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPortfolio();
    }, []);

    const filteredAndSorted = analyses
        .filter(a => a.company_name?.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)); // Drafts might not have created_at yet

    const totalExposure = filteredAndSorted.reduce((acc, curr) => {
        if (curr.status === "DRAFT") return acc; // Don't count drafted exposure yet
        return acc + (curr.limit_recommendation || 0);
    }, 0);

    const getGradeColor = (grade, status) => {
        if (status === "DRAFT") return "text-slate-400 bg-slate-500/10 border-slate-500/20";
        if (["A1", "A2", "A3"].includes(grade)) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
        if (["B1", "B2"].includes(grade)) return "text-teal-400 bg-teal-500/10 border-teal-500/20";
        if (["C1", "C2"].includes(grade)) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
        return "text-red-400 bg-red-500/10 border-red-500/20";
    };

    return (
        <div className="max-w-7xl mx-auto py-8 space-y-8 animate-in fade-in duration-500 px-4 md:px-0">

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <PieChartIcon className="w-8 h-8 text-blue-400" />
                        Credit Portfolio
                    </h1>
                    <p className="text-slate-400 mt-2">Historical registry of all AI underwriting decisions and active institutional exposure.</p>
                </div>

                <div className="glass-panel px-6 py-4 rounded-xl flex items-center gap-4 border-blue-500/20">
                    <div>
                        <p className="text-sm font-medium text-slate-400">Total Recommended Exposure</p>
                        <p className="text-2xl font-mono text-emerald-400 font-bold">${(totalExposure / 1000000).toFixed(2)}M</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 bg-slate-900/50 border border-slate-700 p-2 rounded-xl">
                <Search className="w-5 h-5 text-slate-500 ml-2" />
                <input
                    type="text"
                    placeholder="Search by company name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-transparent border-none text-white focus:outline-none w-full"
                />
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Activity className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-slate-400 font-mono text-sm">Loading historical data from Databricks...</p>
                </div>
            ) : filteredAndSorted.length === 0 ? (
                <div className="glass-card flex flex-col items-center justify-center py-20 text-center rounded-2xl">
                    <FileText className="w-12 h-12 text-slate-600 mb-4" />
                    <h3 className="text-lg font-bold text-white">No Analysis Records Found</h3>
                    <p className="text-slate-400 mt-2">Upload a new credit proposal to see it reflected here.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAndSorted.map((analysis) => {
                        const gradeDetails = getGradeColor(analysis.grade || 'D1', analysis.status);
                        const isDraft = analysis.status === "DRAFT";

                        return (
                            <div
                                key={analysis.analysis_id}
                                className="glass-card p-6 rounded-2xl border border-slate-700/50 hover:border-blue-500/30 transition-all cursor-pointer group flex flex-col justify-between"
                                onClick={() => {
                                    if (isDraft) {
                                        sessionStorage.setItem("draftId", analysis.analysis_id);
                                        router.push("/proposal/new"); // Resume Draft
                                    } else {
                                        sessionStorage.setItem("analysisId", analysis.analysis_id);
                                        router.push("/analyze"); // View Decision
                                    }
                                }}
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-xl font-bold text-white truncate pr-4">{analysis.company_name}</h3>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${gradeDetails}`}>
                                            {isDraft ? 'DRAFT' : (analysis.grade || 'N/A')}
                                        </span>
                                    </div>

                                    <div className="space-y-4 mb-6">
                                        <div className="flex justify-between items-end">
                                            <span className="text-sm text-slate-400">Risk Score</span>
                                            <span className="font-mono text-lg text-white">
                                                {isDraft ? "TBD" : `${(analysis.composite_score || 0).toFixed(1)}/100`}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <span className="text-sm text-slate-400">PD Estimate</span>
                                            <span className="font-mono text-white text-sm">
                                                {isDraft ? "TBD" : `${(analysis.pd_score * 100 || 0).toFixed(2)}%`}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-end pt-2 border-t border-slate-800">
                                            <span className="text-sm text-blue-400 font-medium">Req. / Rec. Exposure</span>
                                            <span className="font-mono text-white font-bold">
                                                ${((analysis.limit_recommendation || 0) / 1000).toFixed(1)}k
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-xs text-slate-500 flex justify-between items-center mt-auto pt-4">
                                    <span>{analysis.created_at ? new Date(analysis.created_at).toLocaleDateString() : 'Active Work'}</span>
                                    <span className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isDraft ? 'text-amber-400' : 'text-blue-400'}`}>
                                        {isDraft ? "Resume Draft" : "View Details"} <ArrowUpRight className="w-3 h-3" />
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
