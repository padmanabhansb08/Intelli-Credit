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
    Clock
} from 'lucide-react';
import NextLink from 'next/link';

export default function ReviewStation() {
    const [activeTab, setActiveTab] = useState('review');
    const [selectedProposal, setSelectedProposal] = useState(1);

    const queue = [
        {
            id: 1,
            company: "Acme Corp Ltd.",
            amount: "$1,500,000",
            status: "Flagged",
            time: "2 hours ago",
            riskGrade: "C",
            pdScore: "3.2%",
            flaggedBy: "Explainable AI Agent",
            reason: "High DTI ratio > 45%"
        },
        {
            id: 2,
            company: "Global Tech Solutions",
            amount: "$850,000",
            status: "Review Needed",
            time: "4 hours ago",
            riskGrade: "B",
            pdScore: "1.8%",
            flaggedBy: "IDP Node",
            reason: "Incomplete KYC documentation"
        },
        {
            id: 3,
            name: "Meridian Logistics",
            amount: "$3,200,000",
            status: "Flagged",
            time: "1 day ago",
            riskGrade: "D",
            pdScore: "5.5%",
            flaggedBy: "PD Model",
            reason: "Model Confidence < 90%"
        },
        {
            id: 4,
            name: "Delta Group",
            amount: "$2,500,000",
            status: "Escalated",
            time: "1 day ago",
            riskGrade: "F",
            pdScore: "12.5%",
            flaggedBy: "Integration API",
            reason: "Sanctions Check Match"
        }
    ];

    const activeDetails = queue.find(q => q.id === selectedProposal) || queue[0];

    return (
        <div className="fixed inset-0 z-[100] bg-[#F8FAFC] text-slate-900 flex flex-col font-sans overflow-hidden">
            {/* Top Navigation Bar */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-blue-700 flex items-center justify-center text-white font-bold text-lg tracking-tighter">
                        N
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-slate-800 leading-tight">NymCard</h1>
                        <p className="text-xs text-slate-500 font-medium leading-tight">Decision Engine</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                        <svg className="w-4 h-4 text-slate-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg>
                    </div>
                    <div className="text-right flex flex-col justify-center">
                        <span className="text-sm font-semibold text-slate-800 leading-tight">amit.amin@nymcard.com</span>
                        <span className="text-xs text-slate-500 font-medium leading-tight">Credit Analyst</span>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar Menu */}
                <aside className="w-64 bg-[#F8FAFC] border-r border-slate-200 flex flex-col py-6 shrink-0">
                    <div className="px-6 mb-2">
                        <h2 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-4">Main Menu</h2>
                    </div>

                    <nav className="flex flex-col gap-1 px-3">
                        <NextLink href="/studio" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'studio' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                            <Network className="w-4 h-4" /> Decision Studio
                        </NextLink>

                        <NextLink href="/connections" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'connections' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                            <ArrowRightLeft className="w-4 h-4" /> Connections
                        </NextLink>

                        <NextLink href="/review" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'review' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                            <FileCheck className="w-4 h-4" /> Review Station
                        </NextLink>
                    </nav>

                    <div className="px-6 mt-10 mb-2">
                        <h2 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-4">Other</h2>
                    </div>

                    <nav className="flex flex-col gap-1 px-3">
                        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                            <Settings className="w-4 h-4" /> Settings
                        </button>
                        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                            <LogOut className="w-4 h-4" /> Logout
                        </button>
                    </nav>
                </aside>

                {/* Dashboard Split View */}
                <main className="flex-1 flex overflow-hidden bg-slate-50">

                    {/* Left Pane: Queue */}
                    <div className="w-1/3 border-r border-slate-200 bg-white flex flex-col shrink-0">
                        <div className="p-4 border-b border-slate-100 flex flex-col gap-1 bg-slate-50/50 shrink-0">
                            <h2 className="font-bold text-slate-800 flex items-center justify-between gap-2">
                                Human-in-the-loop (HITL) Queue <span className="bg-orange-100 text-orange-600 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">4 Escalated</span>
                            </h2>
                            <p className="text-xs text-slate-400">Proposals requiring manual intervention.</p>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {queue.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedProposal(item.id)}
                                    className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${selectedProposal === item.id ? 'bg-blue-50/50 border-l-2 border-l-blue-600' : 'hover:bg-slate-50'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-bold text-slate-800 text-sm truncate pr-4">{item.company || item.name}</h3>
                                        <span className="text-xs font-semibold text-slate-500">{item.amount}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex items-center gap-2">
                                            {item.status === 'Flagged' ? <AlertCircle className="w-3.5 h-3.5 text-orange-500" /> : <Clock className="w-3.5 h-3.5 text-yellow-500" />}
                                            <span className={`text-[11px] font-bold ${item.status === 'Flagged' ? 'text-orange-600' : 'text-yellow-600'}`}>{item.status}</span>
                                        </div>
                                        <span className="text-[10px] font-medium text-slate-400">{item.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Pane: Proposal Details & Actions */}
                    <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-y-auto relative">
                        <div className="p-8 pb-32 max-w-4xl w-full mx-auto">
                            <div className="mb-6">
                                <span className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1 block">Proposal Evaluation</span>
                                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{activeDetails.company || activeDetails.name}</h1>
                            </div>

                            {/* Key Metrics Bento */}
                            <div className="grid grid-cols-3 gap-4 mb-8">
                                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                    <span className="text-xs font-semibold text-slate-500">Requested Amount</span>
                                    <p className="text-xl font-bold text-slate-800 mt-1">{activeDetails.amount}</p>
                                </div>
                                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                    <span className="text-xs font-semibold text-slate-500">Risk Grade</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-xl font-bold text-slate-800">{activeDetails.riskGrade}</p>
                                        <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-1.5 py-0.5 rounded">High Risk</span>
                                    </div>
                                </div>
                                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                    <span className="text-xs font-semibold text-slate-500">Probability of Default</span>
                                    <p className="text-xl font-bold text-red-600 mt-1">{activeDetails.pdScore}</p>
                                </div>
                            </div>

                            {/* Decision Engine Flags */}
                            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="w-5 h-5 text-orange-500" /> Escalation Source
                                    </div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 border border-slate-200 px-2 py-0.5 rounded-md bg-slate-50">Node ID: {activeDetails.flaggedBy}</span>
                                </h3>

                                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                    <p className="text-sm font-bold text-slate-800">{activeDetails.reason}</p>
                                    <p className="text-xs text-slate-500 mt-1">This proposal triggered an automated guardrail and requires manual Human-in-the-Loop review before execution can continue.</p>
                                </div>

                                <h4 className="font-bold text-sm text-slate-800 mt-6 mb-3 border-b border-slate-100 pb-2">Contextual Workload Flags</h4>
                                <ul className="space-y-3">
                                    <li className="flex gap-3 items-start bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        <div className="w-2 h-2 rounded-full bg-slate-400 mt-1.5 shrink-0"></div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">Concentration limit warning: Industry exposure at 14%</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5">Internal Policy Engine rule hit.</p>
                                        </div>
                                    </li>
                                </ul>
                            </div>

                        </div>

                        {/* Sticky Action Footer */}
                        <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 px-8 flex justify-end gap-3 z-10 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                            <button className="px-6 py-2.5 rounded-full text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 flex items-center gap-2 transition-colors">
                                <XCircle className="w-4 h-4" /> Reject
                            </button>
                            <button className="px-6 py-2.5 rounded-full text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 flex items-center gap-2 shadow-sm transition-colors">
                                <MessageSquare className="w-4 h-4" /> Request Info
                            </button>
                            <button className="px-8 py-2.5 rounded-full text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm flex items-center gap-2 transition-colors">
                                <CheckCircle2 className="w-4 h-4" /> Approve Override
                            </button>
                        </div>

                    </div>
                </main>
            </div>
        </div>
    );
}
