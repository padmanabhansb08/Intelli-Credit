"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Activity,
    PieChart as PieChartIcon,
    Search,
    FileText,
    ArrowUpRight,
    ChevronDown,
    ChevronUp,
    ShieldCheck,
    AlertTriangle,
    Download,
    Cpu,
    Filter,
    Plus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useIntelligentSearch } from "@/hooks/useIntelligentSearch";
import { downloadCamPdf } from "@/lib/api";

export default function PortfolioPage() {
    const router = useRouter();

    const {
        searchTerm,
        setSearchTerm,
        filters,
        setFilters,
        results,
        isLoading,
        isError,
    } = useIntelligentSearch({ delay: 300 });

    const [expandedRow, setExpandedRow] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);

    // Calculate F-Pattern top KPIs based on the currently filtered view
    const totalExposure = results.reduce((acc, curr) => {
        if (curr.status === "DRAFT") return acc;
        return acc + (curr.limit_recommendation || curr.revenue || 0); // Using revenue as fallback proxy for limits in this demo if empty
    }, 0);

    const avgScore = results.length > 0
        ? results.reduce((acc, curr) => acc + (curr.composite_score || 0), 0) / results.length
        : 0;

    const highRiskCount = results.filter(r => r.composite_score < 40).length;

    const handleDownload = async (analysisId) => {
        try {
            setIsDownloading(true);
            await downloadCamPdf(analysisId);
        } catch (error) {
            console.error("Failed to download CAM", error);
        } finally {
            setIsDownloading(false);
        }
    };

    const toggleRow = (id) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    return (
        <div className="max-w-7xl mx-auto py-8 space-y-8 animate-in mt-12 fade-in duration-500 px-4 md:px-0">
            {/* 1. Dashboard Header (F-Pattern Start) */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3 text-foreground">
                        <PieChartIcon className="w-8 h-8 text-primary" />
                        Credit Portfolio
                    </h1>
                    <p className="text-muted-foreground mt-2">Historical registry and intelligent semantic analysis of active exposure.</p>
                </div>

                {/* Security Trust Indicators */}
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-secondary/30 px-3 py-1.5 rounded-full border border-border/50">
                    <ShieldCheck className="w-4 h-4 text-success" />
                    Encrypted Vector Store Connected
                </div>
            </div>

            {/* 2. Top-Level KPI Summary Cards (F-Pattern Horizontal Scan) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="px-6 py-4 flex flex-col justify-center border-border/50 bg-card/60 backdrop-blur-sm shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5"><PieChartIcon className="w-16 h-16" /></div>
                    <p className="text-sm font-semibold text-muted-foreground z-10">Total Aggregate Exposure</p>
                    <p className="text-3xl font-mono text-foreground font-bold z-10">${(totalExposure / 1000000).toFixed(2)}M</p>
                </Card>
                <Card className="px-6 py-4 flex flex-col justify-center border-border/50 bg-card/60 backdrop-blur-sm shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5"><Activity className="w-16 h-16" /></div>
                    <p className="text-sm font-semibold text-muted-foreground z-10">Average Portfolio Score</p>
                    <p className="text-3xl font-mono text-primary font-bold z-10">{avgScore.toFixed(1)} / 100</p>
                </Card>
                <Card className="px-6 py-4 flex flex-col justify-center border-destructive/20 bg-destructive/5 backdrop-blur-sm shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 text-destructive"><AlertTriangle className="w-16 h-16" /></div>
                    <p className="text-sm font-semibold text-destructive/80 z-10">High-Risk Delinquency Alerts</p>
                    <p className="text-3xl font-mono text-destructive font-bold z-10">{highRiskCount} Accounts</p>
                </Card>
            </div>

            {/* 3. Intelligent Search Interface (Prominent, Isolated) */}
            <div className="bg-card border border-primary/20 p-1 rounded-xl shadow-lg shadow-primary/5 focus-within:border-primary/50 transition-all duration-300">
                <div className="flex flex-col md:flex-row items-center gap-2 p-2">
                    <div className="flex items-center flex-1 w-full px-3 py-2 bg-secondary/20 rounded-lg">
                        <Cpu className="w-5 h-5 text-primary animate-pulse mr-3" />
                        <input
                            type="text"
                            placeholder="Semantic search... e.g., 'manufacturing companies with low liquidity' or company name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-transparent border-none text-foreground placeholder:text-muted-foreground focus:outline-none w-full text-sm font-medium"
                        />
                        {isLoading && <Activity className="w-4 h-4 text-primary animate-spin ml-2" />}
                    </div>
                </div>

                {/* Dynamic Multi-Select Filter Pills */}
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 mt-1 border-t border-border/30">
                    <Filter className="w-4 h-4 text-muted-foreground mr-1" />
                    <button
                        onClick={() => setFilters(f => ({ ...f, status: f.status === 'COMPLETED' ? null : 'COMPLETED' }))}
                        className={`text-xs px-3 py-1 rounded-full transition-colors border ${filters.status === 'COMPLETED' ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-border hover:bg-secondary'}`}
                    >
                        Completed
                    </button>
                    <button
                        onClick={() => setFilters(f => ({ ...f, status: f.status === 'DRAFT' ? null : 'DRAFT' }))}
                        className={`text-xs px-3 py-1 rounded-full transition-colors border ${filters.status === 'DRAFT' ? 'bg-warning text-warning-foreground border-warning' : 'bg-transparent text-muted-foreground border-border hover:bg-secondary'}`}
                    >
                        Drafts
                    </button>
                    <button
                        onClick={() => setFilters(f => ({ ...f, min_score: f.min_score ? null : 80 }))}
                        className={`text-xs px-3 py-1 rounded-full transition-colors border ${filters.min_score === 80 ? 'bg-success text-success-foreground border-success' : 'bg-transparent text-muted-foreground border-border hover:bg-secondary'}`}
                    >
                        Score &gt; 80
                    </button>
                </div>
            </div>

            {/* 4. Data Presentation & Empty States */}
            {isLoading && results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Activity className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-muted-foreground font-mono text-sm">Querying distributed vector store...</p>
                </div>
            ) : results.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-20 text-center shadow-sm border-dashed border-2 border-border/50 bg-secondary/10">
                    <div className="bg-primary/10 p-4 rounded-full mb-4">
                        <FileText className="w-8 h-8 text-primary" />
                    </div>
                    <CardTitle className="text-xl mb-2">No Credit Records Found</CardTitle>
                    <CardDescription className="max-w-md text-sm mb-6">
                        {searchTerm
                            ? "We couldn't find any records matching your semantic query. Try adjusting your parameters or filters."
                            : "Your portfolio is currently empty. Initiate a new AI underwriting workflow to populate your dashboard."}
                    </CardDescription>
                    <Button onClick={() => router.push("/proposal/new")} size="lg" className="shadow-lg shadow-primary/20">
                        <Plus className="w-4 h-4 mr-2" /> Upload New Credit Proposal
                    </Button>
                </Card>
            ) : (
                <div className="space-y-4">
                    {/* Data Table / List View */}
                    <div className="rounded-xl border border-border bg-card/30 overflow-hidden">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 p-4 border-b border-border bg-secondary/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <div className="col-span-4">Company Name</div>
                            <div className="col-span-2 text-center">Score</div>
                            <div className="col-span-3">Match Context</div>
                            <div className="col-span-2 text-right">Status</div>
                            <div className="col-span-1 text-center">Details</div>
                        </div>

                        {/* Expandable Rows (Progressive Disclosure) */}
                        <div className="divide-y divide-border/50">
                            {results.map((record) => {
                                const isDraft = record.status === "DRAFT";
                                const isExpanded = expandedRow === record.id;
                                const isHighRisk = record.composite_score < 40;
                                const scoreColor = isHighRisk ? 'text-destructive' : (record.composite_score > 75 ? 'text-success' : 'text-foreground');

                                return (
                                    <div key={record.id} className={`transition-colors ${isExpanded ? 'bg-secondary/10' : 'hover:bg-secondary/5'}`}>
                                        {/* Primary Row Data */}
                                        <div
                                            className="grid grid-cols-12 gap-4 p-4 items-center cursor-pointer"
                                            onClick={() => toggleRow(record.id)}
                                        >
                                            <div className="col-span-4 flex flex-col">
                                                <span className="font-semibold text-foreground truncate">{record.company_name}</span>
                                                <span className="text-xs text-muted-foreground truncate">{record.industry || 'N/A Sector'}</span>
                                            </div>

                                            <div className="col-span-2 text-center">
                                                <span className={`font-mono font-bold text-lg ${scoreColor}`}>
                                                    {isDraft ? "TBD" : (record.composite_score ? record.composite_score.toFixed(0) : 'N/A')}
                                                </span>
                                            </div>

                                            <div className="col-span-3 flex flex-col">
                                                {record.match_type && (
                                                    <span className="text-xs px-2 py-0.5 rounded-sm bg-primary/10 text-primary w-fit border border-primary/20 inline-flex items-center">
                                                        {record.match_type}
                                                    </span>
                                                )}
                                                {record.match_score > 0 && (
                                                    <span className="text-[10px] text-muted-foreground mt-1">RRF Conf: {(record.match_score * 100).toFixed(1)}%</span>
                                                )}
                                            </div>

                                            <div className="col-span-2 text-right">
                                                <Badge variant={isDraft ? "warning" : "default"} className="ml-auto block w-fit">
                                                    {record.status}
                                                </Badge>
                                            </div>

                                            <div className="col-span-1 flex justify-center text-muted-foreground">
                                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                            </div>
                                        </div>

                                        {/* Expanded Details Panel (Slide-down disclosure) */}
                                        {isExpanded && (
                                            <div className="p-4 pt-0 border-t border-border/50 bg-secondary/5 animate-in slide-in-from-top-2 duration-200">
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
                                                    {/* Deep Dive Metrics */}
                                                    <div className="space-y-4">
                                                        <h4 className="text-sm font-semibold text-primary uppercase tracking-widest flex items-center gap-2">
                                                            <Activity className="w-4 h-4" /> Financials & Analytics
                                                        </h4>
                                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                                            <div>
                                                                <p className="text-muted-foreground text-xs">Ann. Revenue</p>
                                                                <p className="font-mono font-semibold">${((record.revenue || 0) / 1000000).toFixed(1)}M</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-muted-foreground text-xs">Processed Date</p>
                                                                <p className="font-mono">{record.created_at ? new Date(record.created_at).toLocaleDateString() : 'Active'}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Action Center */}
                                                    <div className="col-span-1 lg:col-span-2 flex flex-col justify-end items-start md:items-end space-y-3">
                                                        {isDraft ? (
                                                            <Button
                                                                onClick={() => {
                                                                    sessionStorage.setItem("draftId", record.id); // Or draft correlation
                                                                    router.push("/proposal/new");
                                                                }}
                                                            >
                                                                Resume Draft Analysis <ArrowUpRight className="w-4 h-4 ml-2" />
                                                            </Button>
                                                        ) : (
                                                            <div className="flex gap-3">
                                                                <Button
                                                                    variant="outline"
                                                                    onClick={() => {
                                                                        // Assuming standard navigation
                                                                        sessionStorage.setItem("analysisId", record.application_id || record.id);
                                                                        router.push("/analyze");
                                                                    }}
                                                                >
                                                                    View Full Dashboard
                                                                </Button>
                                                                <Button
                                                                    onClick={() => handleDownload(record.application_id || record.id)}
                                                                    disabled={isDownloading}
                                                                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                                                                >
                                                                    {isDownloading ? (
                                                                        <Activity className="w-4 h-4 mr-2 animate-spin" />
                                                                    ) : (
                                                                        <Download className="w-4 h-4 mr-2" />
                                                                    )}
                                                                    Download Official CAM
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
