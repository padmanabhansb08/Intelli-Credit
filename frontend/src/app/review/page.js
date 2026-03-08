"use client";

import React, { useState } from 'react';
import {
    Network,
    ArrowRightLeft,
    FileCheck,
    Settings,
    LogOut,
    CheckCircle2,
    XCircle,
    AlertCircle,
    MessageSquare,
    Clock,
    ShieldAlert,
    TrendingUp,
    TrendingDown,
    Activity,
    Lock
} from 'lucide-react';
import NextLink from 'next/link';
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";

export default function ReviewStation() {
    const [activeTab, setActiveTab] = useState('review');
    const [selectedProposal, setSelectedProposal] = useState(1);
    const [showOverrideModal, setShowOverrideModal] = useState(false);
    const [justification, setJustification] = useState('');

    const queue = [
        {
            id: 1,
            company: "Acme Corp Ltd.",
            amount: "$1,500,000",
            status: "Action Required",
            time: "2 hours ago",
            riskGrade: "C",
            pdScore: "18.5%",
            pdTrend: "+2.1% MoM",
            pdIndustryAvg: "12.4%",
            lgdScore: "45%",
            lgdTrend: "-1.2% YoY",
            lgdIndustryAvg: "40%",
            eadTrend: "+5% QoQ",
            flaggedBy: "Explainable AI Agent",
            reason: "High DTI ratio > 45%",
            concentrationText: "Concentration limit warning: Industry exposure at 14%",
            concentrationContext: "Industry average limit is 10%. Previous quarter was 12.5%."
        },
        {
            id: 2,
            company: "Global Tech Solutions",
            amount: "$850,000",
            status: "Review Needed",
            time: "4 hours ago",
            riskGrade: "B",
            pdScore: "3.2%",
            pdTrend: "-0.5% MoM",
            pdIndustryAvg: "4.1%",
            lgdScore: "35%",
            lgdTrend: "Stable",
            lgdIndustryAvg: "38%",
            eadTrend: "+2% QoQ",
            flaggedBy: "IDP Node",
            reason: "Incomplete KYC documentation",
            concentrationText: "Missing beneficial ownership forms.",
            concentrationContext: "Required for Tier 1 compliance. 98% of peers completed."
        },
        {
            id: 3,
            name: "Meridian Logistics",
            amount: "$3,200,000",
            status: "Action Required",
            time: "1 day ago",
            riskGrade: "D",
            pdScore: "24.5%",
            pdTrend: "+5.5% MoM",
            pdIndustryAvg: "15.0%",
            lgdScore: "60%",
            lgdTrend: "+4.0% YoY",
            lgdIndustryAvg: "55%",
            eadTrend: "+15% QoQ",
            flaggedBy: "PD Model",
            reason: "Model Confidence < 90%",
            concentrationText: "Exposure approaches regional cap of $3.5M.",
            concentrationContext: "Current exposure $3.2M. +15% vs LY."
        },
        {
            id: 4,
            name: "Delta Group",
            amount: "$2,500,000",
            status: "Critical Escalation",
            time: "1 day ago",
            riskGrade: "F",
            pdScore: "42.5%",
            pdTrend: "+12.5% MoM",
            pdIndustryAvg: "18.0%",
            lgdScore: "85%",
            lgdTrend: "+10.0% YoY",
            lgdIndustryAvg: "65%",
            eadTrend: "+2.5% YoY",
            flaggedBy: "Integration API",
            reason: "Sanctions Check Match",
            concentrationText: "Entity flagged on OFAC suspected list.",
            concentrationContext: "Zero tolerance policy threshold."
        }
    ];

    const activeDetails = queue.find(q => q.id === selectedProposal) || queue[0];

    const getStatusColor = (status) => {
        switch (status) {
            case 'Critical Escalation': return 'destructive';
            case 'Action Required': return 'warning';
            default: return 'default';
        }
    };

    const isSevereRisk = activeDetails.status === 'Critical Escalation' || activeDetails.status === 'Action Required';

    return (
        <div className="fixed inset-0 z-[100] bg-background text-foreground flex flex-col font-sans overflow-hidden">
            {/* Top Navigation Bar */}
            <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shrink-0 relative z-30">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg tracking-tighter">
                        I
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-foreground leading-tight">Intelli-Credit</h1>
                        <p className="text-xs text-muted-foreground font-medium leading-tight">Decision Engine</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center overflow-hidden">
                        <svg className="w-4 h-4 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
                    </div>
                    <div className="text-right flex flex-col justify-center">
                        <span className="text-sm font-semibold text-foreground leading-tight">officer@intelli-credit.com</span>
                        <span className="text-xs text-muted-foreground font-medium leading-tight">Credit Analyst</span>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar Menu */}
                <aside className="w-64 bg-secondary/10 border-r border-border flex flex-col py-6 shrink-0 z-20">
                    <div className="px-6 mb-2">
                        <h2 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase mb-4">Main Menu</h2>
                    </div>

                    <nav className="flex flex-col gap-1 px-3">
                        <NextLink href="/" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-background text-primary shadow-sm border border-border' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                            <Activity className="w-4 h-4" /> Workspace
                        </NextLink>

                        <NextLink href="/studio" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'studio' ? 'bg-background text-primary shadow-sm border border-border' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                            <Network className="w-4 h-4" /> Decision Studio
                        </NextLink>

                        <NextLink href="/portfolio" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'portfolio' ? 'bg-background text-primary shadow-sm border border-border' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                            <FileCheck className="w-4 h-4" /> Active Portfolio
                        </NextLink>

                        <NextLink href="/review" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'review' ? 'bg-background text-primary shadow-sm border border-border' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                            <FileCheck className="w-4 h-4" /> Review Station
                        </NextLink>
                    </nav>

                    <div className="px-6 mt-10 mb-2">
                        <h2 className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase mb-4">Other</h2>
                    </div>

                    <nav className="flex flex-col gap-1 px-3">
                        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors w-full text-left">
                            <Settings className="w-4 h-4" /> Settings
                        </button>
                        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors w-full text-left">
                            <LogOut className="w-4 h-4" /> Logout
                        </button>
                    </nav>
                </aside>

                {/* Dashboard Split View */}
                <main className="flex-1 flex overflow-hidden bg-background">

                    {/* Left Pane: Queue */}
                    <div className="w-[320px] lg:w-[380px] xl:w-1/3 border-r border-border bg-card flex flex-col shrink-0 z-10">
                        <div className="p-4 border-b border-border flex flex-col gap-1 bg-secondary/20 shrink-0">
                            <h2 className="font-bold text-foreground flex items-center justify-between gap-2">
                                HITL Queue <Badge variant="destructive" className="px-1.5 py-0 flex gap-1 items-center font-bold font-mono"><AlertTriangle className="w-3 h-3" /> 4</Badge>
                            </h2>
                            <p className="text-xs text-muted-foreground font-medium">Proposals requiring manual intervention.</p>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {queue.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedProposal(item.id)}
                                    className={`p-4 border-b border-border cursor-pointer transition-all ${selectedProposal === item.id ? 'bg-primary/5 border-l-[3px] border-l-primary' : 'hover:bg-secondary/50 border-l-[3px] border-l-transparent'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-bold text-foreground text-sm truncate pr-4">{item.company || item.name}</h3>
                                        <span className="text-xs font-bold text-muted-foreground">{item.amount}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <Badge variant={getStatusColor(item.status)} className="flex items-center gap-1 font-bold">
                                            {item.status === 'Critical Escalation' ? <ShieldAlert className="w-3 h-3" /> : (item.status === 'Action Required' ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />)}
                                            {item.status}
                                        </Badge>
                                        <span className="text-[10px] font-semibold text-muted-foreground">{item.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Pane: Proposal Details & Actions */}
                    <div className="flex-1 flex flex-col bg-background/50 overflow-y-auto relative">
                        <div className="p-8 pb-32 max-w-5xl w-full mx-auto">

                            {/* Severe Risk Banner */}
                            {isSevereRisk && (
                                <div className={`px-6 py-4 rounded-xl mb-6 shadow-sm border flex items-start gap-4 animate-in fade-in slide-in-from-top-4 ${activeDetails.status === 'Critical Escalation' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-warning/10 text-warning border-warning/20'}`}>
                                    <ShieldAlert className={`w-8 h-8 shrink-0 ${activeDetails.status === 'Critical Escalation' ? 'text-destructive' : 'text-warning'}`} />
                                    <div>
                                        <h4 className="font-extrabold text-lg leading-tight flex items-center gap-2">
                                            {activeDetails.status === 'Critical Escalation' ? 'CRITICAL RISK ESCALATION' : 'ACTION REQUIRED'}
                                            <Badge variant={activeDetails.status === 'Critical Escalation' ? 'destructive' : 'warning'} className="text-[10px] uppercase">Node ID: {activeDetails.flaggedBy}</Badge>
                                        </h4>
                                        <p className="text-sm mt-1 font-medium">
                                            {activeDetails.reason}. Immediate override justification required.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="mb-8 flex justify-between items-end">
                                <div>
                                    <span className="text-[11px] font-bold text-primary uppercase tracking-widest mb-1.5 block">Proposal Evaluation</span>
                                    <h1 className="text-3xl font-black text-foreground tracking-tight">{activeDetails.company || activeDetails.name}</h1>
                                </div>
                                {!isSevereRisk && (
                                    <div className="flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-lg border border-border">
                                        <span className="text-xs uppercase font-bold text-muted-foreground">Source:</span>
                                        <span className="text-xs font-bold text-foreground">{activeDetails.flaggedBy}</span>
                                    </div>
                                )}
                            </div>

                            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2 border-b border-border pb-2">
                                <Activity className="w-4 h-4 text-primary" />
                                Expected Loss (EL) Framework
                            </h3>

                            {/* Key Metrics Bento */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                                {/* Exposure at Default */}
                                <Card className="p-5 relative overflow-hidden group hover:border-border transition-colors shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                            Exposure at Default
                                        </span>
                                        <Badge variant={activeDetails.eadTrend.startsWith('+') ? 'warning' : 'success'} className="text-[10px] flex gap-1">
                                            {activeDetails.eadTrend.startsWith('+') ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                            {activeDetails.eadTrend}
                                        </Badge>
                                    </div>
                                    <div className="flex items-baseline gap-2 mb-4">
                                        <p className="text-3xl font-black text-foreground tracking-tight">{activeDetails.amount}</p>
                                    </div>
                                    <div className="pt-3 border-t border-border/50">
                                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-muted-foreground mb-1.5">
                                            <span>Requested vs Capacity</span>
                                            <span>85%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                                            <div className="h-full bg-primary rounded-full" style={{ width: '85%' }} />
                                        </div>
                                    </div>
                                </Card>

                                {/* Probability of Default */}
                                <Card className="p-5 relative overflow-hidden group transition-colors shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                            Probability of Default
                                        </span>
                                        <Badge variant={activeDetails.pdTrend.startsWith('+') ? 'destructive' : 'success'} className="text-[10px] flex gap-1">
                                            {activeDetails.pdTrend.startsWith('+') ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                            {activeDetails.pdTrend}
                                        </Badge>
                                    </div>
                                    <div className="flex items-baseline gap-2 mb-4">
                                        <p className={`text-3xl font-black tracking-tight ${parseFloat(activeDetails.pdScore) > 20 ? 'text-destructive' : 'text-foreground'}`}>{activeDetails.pdScore}</p>
                                    </div>
                                    <div className="pt-3 border-t border-border/50">
                                        <div className="flex justify-between items-center text-[10px] uppercase font-bold mb-1.5">
                                            <span className="text-muted-foreground">Industry Avg Benchmark</span>
                                            <span className="text-foreground">{activeDetails.pdIndustryAvg}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden flex">
                                            <div className="h-full bg-border" style={{ width: activeDetails.pdIndustryAvg }} />
                                            {parseFloat(activeDetails.pdScore) > parseFloat(activeDetails.pdIndustryAvg) && (
                                                <div className="h-full bg-destructive" style={{ width: `calc(${parseFloat(activeDetails.pdScore) - parseFloat(activeDetails.pdIndustryAvg)}%)` }} />
                                            )}
                                        </div>
                                    </div>
                                </Card>

                                {/* Loss Given Default */}
                                <Card className="p-5 relative overflow-hidden group transition-colors shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                            Loss Given Default
                                        </span>
                                        <Badge variant={activeDetails.lgdTrend.startsWith('+') ? 'warning' : (activeDetails.lgdTrend === 'Stable' ? 'secondary' : 'success')} className="text-[10px] flex gap-1">
                                            {activeDetails.lgdTrend.startsWith('+') && <TrendingUp className="w-3 h-3" />}
                                            {activeDetails.lgdTrend.startsWith('-') && <TrendingDown className="w-3 h-3" />}
                                            {activeDetails.lgdTrend}
                                        </Badge>
                                    </div>
                                    <div className="flex items-baseline gap-2 mb-4">
                                        <p className="text-3xl font-black text-foreground tracking-tight">{activeDetails.lgdScore}</p>
                                    </div>
                                    <div className="pt-3 border-t border-border/50">
                                        <div className="flex justify-between items-center text-[10px] uppercase font-bold mb-1.5">
                                            <span className="text-muted-foreground">Industry Avg Benchmark</span>
                                            <span className="text-foreground">{activeDetails.lgdIndustryAvg}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden flex">
                                            <div className="h-full bg-border" style={{ width: activeDetails.lgdIndustryAvg }} />
                                            {parseFloat(activeDetails.lgdScore) > parseFloat(activeDetails.lgdIndustryAvg) && (
                                                <div className="h-full bg-warning" style={{ width: `calc(${parseFloat(activeDetails.lgdScore) - parseFloat(activeDetails.lgdIndustryAvg)}%)` }} />
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            {/* Contextual Benchmarking & Alerts */}
                            <Card className="p-6 shadow-sm mb-6">
                                <h4 className="font-bold text-sm text-foreground mb-4 border-b border-border pb-2 flex items-center gap-2">
                                    <Network className="w-4 h-4 text-primary" />
                                    Contextual Policy Flags
                                </h4>
                                <ul className="space-y-4">
                                    <li className="flex gap-4 items-start p-4 rounded-lg border border-border bg-card">
                                        <div className="w-8 h-8 rounded-full bg-background border border-border shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                                            <AlertCircle className="w-4 h-4 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-foreground">{activeDetails.concentrationText}</p>
                                            <p className="text-xs text-muted-foreground mt-1 font-medium leading-relaxed">{activeDetails.concentrationContext}</p>

                                            {/* Contextual Visual Benchmark */}
                                            {activeDetails.concentrationText.includes("14%") && (
                                                <div className="mt-3 bg-background border border-border rounded p-3">
                                                    <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground mb-2">
                                                        <span>Current (14%)</span>
                                                        <span>Limit (15%)</span>
                                                    </div>
                                                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden flex relative">
                                                        {/* Industry Avg Marker */}
                                                        <div className="absolute top-0 bottom-0 w-0.5 bg-primary z-10" style={{ left: '66.6%' }} title="Industry Avg: 10%"></div>
                                                        <div className="h-full bg-warning" style={{ width: '93.3%' }} />
                                                    </div>
                                                    <div className="flex justify-between mt-1 text-[9px] font-bold text-muted-foreground">
                                                        <span className="text-primary pl-[66.6%] -ml-4">Avg: 10%</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                </ul>
                            </Card>

                        </div>

                        {/* Strategic Friction Modal */}
                        {showOverrideModal && (
                            <>
                                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-40" onClick={() => setShowOverrideModal(false)}></div>
                                <div className="absolute bottom-24 right-8 z-50 w-full max-w-lg bg-card border border-border rounded-2xl p-6 shadow-2xl">
                                    <div className="flex items-center gap-3 text-destructive border-b border-border/50 pb-4 mb-4">
                                        <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                                            <Lock className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-foreground">Mandatory Compliance Justification</h3>
                                            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Compliance auditing requires detailed rationale.</p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 block">Business Rationale for Override</label>
                                        <textarea
                                            autoFocus
                                            className="w-full border border-input rounded-xl p-3 text-sm focus:ring-2 focus:ring-ring focus:border-ring outline-none transition-all placeholder:text-muted-foreground min-h-[120px] resize-none shadow-sm bg-background text-foreground"
                                            placeholder="Enter detailed justification for overriding this blocked proposal. Minimum 40 characters required for immutable audit logs."
                                            value={justification}
                                            onChange={(e) => setJustification(e.target.value)}
                                        />
                                        <div className="flex justify-between mt-2 items-center text-xs">
                                            <span className={`${justification.length < 40 ? 'text-warning font-bold' : 'text-success font-bold'}`}>
                                                {justification.length} / 40 minimum characters
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border/50">
                                        <Button variant="outline" onClick={() => setShowOverrideModal(false)}>
                                            Cancel
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            disabled={justification.length < 40}
                                            className="flex items-center gap-2"
                                            onClick={() => {
                                                setShowOverrideModal(false);
                                                setJustification('');
                                            }}
                                        >
                                            <ShieldAlert className="w-4 h-4" />
                                            Confirm Biometric Exception
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Sticky Action Footer */}
                        <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border p-4 px-8 flex justify-between items-center z-30 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)]">
                            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                <Clock className="w-4 h-4" /> Session expires in 14:59
                            </div>
                            <div className="flex items-center gap-3">
                                <Button variant="outline" className="flex items-center gap-2 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive">
                                    <XCircle className="w-4 h-4" /> Reject Proposal
                                </Button>
                                <Button variant="secondary" className="flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4" /> Request User Info
                                </Button>
                                <Button
                                    variant={isSevereRisk ? "destructive" : "success"}
                                    onClick={() => setShowOverrideModal(true)}
                                    className={`flex items-center gap-2 px-8 rounded-full`}
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    {isSevereRisk ? 'Override Block' : 'Approve Decision'}
                                </Button>
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </div>
    );
}
