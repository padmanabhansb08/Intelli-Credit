"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ShieldCheck, PieChart as PieChartIcon, Search, FileText, ArrowUpRight } from "lucide-react";
import { getAnalyses, getDrafts } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import useAppStore from "@/store/useAppStore";

export default function PortfolioPage() {
    const router = useRouter();
    const [analyses, setAnalyses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Pull any completed analyses from the global store as a fallback
    const storeResult = useAppStore(s => s.activeAnalysisResult);
    const storeAnalysisId = useAppStore(s => s.activeAnalysisId);

    useEffect(() => {
        const fetchPortfolio = async () => {
            try {
                const [completedData, draftsData] = await Promise.all([
                    getAnalyses(),
                    getDrafts()
                ]);

                const combined = [
                    ...(Array.isArray(completedData) ? completedData : []),
                    ...(Array.isArray(draftsData?.drafts) ? draftsData.drafts : [])
                ];
                setAnalyses(combined);
            } catch (err) {
                console.warn("Backend offline — falling back to local store data.", err.message);
                // Use store data as fallback when backend is unavailable
                if (storeResult) {
                    setAnalyses([{
                        analysis_id: storeAnalysisId || 'local-1',
                        company_name: 'Acme Corp Ltd.',
                        status: storeResult.decision?.decision || 'COMPLETED',
                        grade: storeResult.composite_risk?.composite_score >= 70 ? 'B1' : 'C1',
                        composite_score: storeResult.composite_risk?.composite_score || 65,
                        pd_score: 0.055,
                        limit_recommendation: storeResult.decision?.summary?.recommended_limit || 0,
                        created_at: new Date().toISOString(),
                    }]);
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchPortfolio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredAndSorted = analyses
        .filter(a => a.company_name?.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)); // Drafts might not have created_at yet

    const totalExposure = filteredAndSorted.reduce((acc, curr) => {
        if (curr.status === "DRAFT") return acc; // Don't count drafted exposure yet
        return acc + (curr.limit_recommendation || 0);
    }, 0);

    const getGradeVariant = (grade, status) => {
        if (status === "DRAFT") return "secondary";
        if (["A1", "A2", "A3"].includes(grade)) return "success";
        if (["B1", "B2"].includes(grade)) return "default";
        if (["C1", "C2"].includes(grade)) return "warning";
        return "destructive";
    };

    return (
        <div className="max-w-7xl mx-auto py-8 space-y-8 animate-in mt-12 fade-in duration-500 px-4 md:px-0">

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3 text-foreground">
                        <PieChartIcon className="w-8 h-8 text-primary" />
                        Credit Portfolio
                    </h1>
                    <p className="text-muted-foreground mt-2">Historical registry of all AI underwriting decisions and active institutional exposure.</p>
                </div>

                <Card className="px-6 py-4 flex items-center gap-4 border-border/50 bg-card/60 backdrop-blur-sm shadow-sm">
                    <div>
                        <p className="text-sm font-semibold text-muted-foreground">Total Recommended Exposure</p>
                        <p className="text-2xl font-mono text-success font-bold">${(totalExposure / 1000000).toFixed(2)}M</p>
                    </div>
                </Card>
            </div>

            <div className="flex items-center gap-4 bg-secondary/30 border border-input p-2 rounded-xl backdrop-blur-sm">
                <Search className="w-5 h-5 text-muted-foreground ml-2" />
                <input
                    type="text"
                    placeholder="Search by company name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-transparent border-none text-foreground placeholder:text-muted-foreground focus:outline-none w-full text-sm"
                />
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Activity className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-muted-foreground font-mono text-sm">Loading historical data...</p>
                </div>
            ) : filteredAndSorted.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-20 text-center shadow-sm">
                    <FileText className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                    <CardTitle className="text-lg">No Analysis Records Found</CardTitle>
                    <CardDescription className="mt-2 text-sm">Upload a new credit proposal to see it reflected here.</CardDescription>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAndSorted.map((analysis) => {
                        const gradeVariant = getGradeVariant(analysis.grade || 'D1', analysis.status);
                        const isDraft = analysis.status === "DRAFT";

                        return (
                            <Card
                                key={analysis.analysis_id}
                                className="hover:border-primary/50 transition-colors cursor-pointer group flex flex-col justify-between shadow-sm"
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
                                <CardHeader className="pb-4">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg truncate pr-4">{analysis.company_name}</CardTitle>
                                        <Badge variant={gradeVariant} className="shrink-0 shadow-sm">
                                            {isDraft ? 'DRAFT' : (analysis.grade || 'N/A')}
                                        </Badge>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-4 mb-2">
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Risk Score</span>
                                        <span className="font-mono font-semibold text-foreground">
                                            {isDraft ? "TBD" : `${(analysis.composite_score || 0).toFixed(1)}/100`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">PD Estimate</span>
                                        <span className="font-mono font-semibold text-foreground text-sm">
                                            {isDraft ? "TBD" : `${(analysis.pd_score * 100 || 0).toFixed(2)}%`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end pt-3 border-t border-border/50">
                                        <span className="text-xs font-semibold text-primary uppercase tracking-widest">Req. / Rec. Exposure</span>
                                        <span className="font-mono text-foreground font-bold">
                                            ${((analysis.limit_recommendation || 0) / 1000).toFixed(1)}k
                                        </span>
                                    </div>
                                </CardContent>

                                <CardFooter className="pt-0 flex justify-between items-center mt-auto border-t border-transparent text-xs text-muted-foreground">
                                    <span>{analysis.created_at ? new Date(analysis.created_at).toLocaleDateString() : 'Active Work'}</span>
                                    <span className={`flex items-center gap-1 font-semibold opacity-0 group-hover:opacity-100 transition-opacity ${isDraft ? 'text-warning' : 'text-primary'}`}>
                                        {isDraft ? "Resume Draft" : "View Details"} <ArrowUpRight className="w-3 h-3" />
                                    </span>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
