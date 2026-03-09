"use client";

import React, { useState } from 'react';
import {
    Network,
    ArrowRightLeft,
    FileCheck,
    Settings,
    LogOut,
    Plus,
    Database,
    Globe,
    ShieldAlert,
    Cpu,
    Building2,
    Hexagon,
    MoreVertical,
    Activity,
    ArrowLeft,
    Terminal,
    Users,
    PlayCircle,
    RefreshCw,
    Edit3,
    Trash2,
    CheckCircle2,
    Key
} from 'lucide-react';
import NextLink from 'next/link';

export default function ConnectionsDashboard() {
    const [activeTab, setActiveTab] = useState('connections');
    const [activeConnectionId, setActiveConnectionId] = useState(null);
    const [actionMenuOpen, setActionMenuOpen] = useState(null);

    const connections = [
        {
            id: 1,
            name: "OpenAI Foundation Models",
            type: "AI Inference Service",
            status: "Operational",
            latency: "45ms",
            errorRate: "0.02%",
            uptime: "99.99%",
            requests: "12.4k/min",
            icon: <Hexagon className="w-6 h-6 text-slate-700" />,
            endpoint: "https://api.openai.com/v1/chat/completions",
            webhooks: 3,
            lastSync: "Updated 2 mins ago"
        },
        {
            id: 2,
            name: "Equifax Core",
            type: "Credit Bureau Data",
            status: "Degraded",
            latency: "1250ms",
            errorRate: "5.40%",
            uptime: "98.50%",
            requests: "340/min",
            icon: <Building2 className="w-6 h-6 text-blue-600" />,
            endpoint: "https://api.equifax.com/v2/pull/consumer/comprehensive-long-url-test-truncation-handling-very-long-indeed",
            webhooks: 1,
            lastSync: "Updated 15 mins ago"
        },
        {
            id: 3,
            name: "Transaction Postgres DB",
            type: "Relational Database",
            status: "Operational",
            latency: "12ms",
            errorRate: "0.00%",
            uptime: "100%",
            requests: "45k/min",
            icon: <Database className="w-6 h-6 text-indigo-600" />,
            endpoint: "postgresql://pro-cluster-01.db.nymcard.internal:5432/transactions",
            webhooks: 0,
            lastSync: "Real-time stream"
        },
        {
            id: 4,
            name: "Threat Matrix Engine",
            type: "Fraud & Security",
            status: "Operational",
            latency: "18ms",
            errorRate: "0.01%",
            uptime: "99.95%",
            requests: "8.2k/min",
            icon: <ShieldAlert className="w-6 h-6 text-orange-600" />,
            endpoint: "https://fraud.nymcard.com/api/v1/evaluate",
            webhooks: 5,
            lastSync: "Updated 1 min ago"
        },
        {
            id: 5,
            name: "Legacy Core Banking",
            type: "HTTP Integration",
            status: "Offline",
            latency: "--",
            errorRate: "100%",
            uptime: "82.40%",
            requests: "0/min",
            icon: <Globe className="w-6 h-6 text-purple-600" />,
            endpoint: "http://10.0.4.55:8080/mainframe/sync",
            webhooks: 0,
            lastSync: "Connection lost 2 hours ago"
        },
        {
            id: 6,
            name: "Anthropic Claude API",
            type: "AI Service",
            status: "Operational",
            latency: "110ms",
            errorRate: "0.05%",
            uptime: "99.90%",
            requests: "4.1k/min",
            icon: <Cpu className="w-6 h-6 text-slate-800" />,
            endpoint: "https://api.anthropic.com/v1/messages",
            webhooks: 2,
            lastSync: "Updated 5 mins ago"
        }
    ];

    const toggleActionMenu = (e, id) => {
        e.stopPropagation();
        if (actionMenuOpen === id) setActionMenuOpen(null);
        else setActionMenuOpen(id);
    };

    const getStatusIndicator = (status) => {
        switch (status) {
            case 'Operational':
                return <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>;
            case 'Degraded':
                return <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-20"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span></span>;
            case 'Offline':
            default:
                return <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#F8FAFC] text-slate-900 flex flex-col font-sans overflow-hidden">
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30 relative">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-blue-700 flex items-center justify-center text-white font-bold text-lg tracking-tighter">N</div>
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
                        <span className="text-xs text-slate-500 font-medium leading-tight">Systems Admin</span>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-64 bg-[#F8FAFC] border-r border-slate-200 flex flex-col py-6 shrink-0 z-20 hidden md:flex">
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

                <main className="flex-1 bg-[#F1F5F9] overflow-y-auto w-full pb-20 relative">
                    {/* Sub-Dashboard Drill-Down */}
                    {activeConnectionId ? (() => {
                        const conn = connections.find(c => c.id === activeConnectionId);
                        return (
                            <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in slide-in-from-right-8 fade-in duration-300">
                                <button onClick={() => setActiveConnectionId(null)} className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors bg-white px-4 py-2 border border-slate-200 rounded-full shadow-sm hover:shadow-md">
                                    <ArrowLeft className="w-4 h-4" /> Back to Integration Hub
                                </button>

                                <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm mb-8 flex flex-col md:flex-row gap-8 items-start justify-between">
                                    <div className="flex items-start gap-5">
                                        <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                                            {conn.icon && React.cloneElement(conn.icon, { className: "w-8 h-8 text-slate-700" })}
                                        </div>
                                        <div>
                                            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{conn.name}</h2>
                                                <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 w-fit">
                                                    {getStatusIndicator(conn.status)}
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${conn.status === 'Operational' ? 'text-emerald-700' : (conn.status === 'Degraded' ? 'text-orange-700' : 'text-red-700')}`}>{conn.status}</span>
                                                </div>
                                            </div>
                                            <p className="text-sm font-medium text-slate-500 mb-3">{conn.type}</p>
                                            <p className="text-xs font-mono text-slate-600 bg-slate-100 px-3 py-1.5 rounded border border-slate-200 break-all max-w-xl">{conn.endpoint}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 w-full md:w-auto">
                                        <button className="flex-1 md:flex-none justify-center px-4 py-2.5 rounded-lg text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-sm flex items-center gap-2 transition-all">
                                            <RefreshCw className="w-4 h-4" /> Sync Now
                                        </button>
                                        <button className="flex-1 md:flex-none justify-center px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center gap-2 transition-all">
                                            <Edit3 className="w-4 h-4" /> Edit Connection
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-12 gap-8">
                                    <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
                                        {/* Live Endpoint Telemetry */}
                                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                            <h3 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
                                                <Activity className="w-5 h-5 text-blue-600" /> Live Endpoint Telemetry
                                            </h3>
                                            <div className="grid grid-cols-3 gap-6 mb-6">
                                                <div>
                                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">P95 Latency</p>
                                                    <p className={`text-2xl lg:text-3xl font-black ${parseInt(conn.latency) > 500 ? 'text-orange-600' : 'text-slate-900'}`}>{conn.latency}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">Error Rate (5m)</p>
                                                    <p className={`text-2xl lg:text-3xl font-black ${parseFloat(conn.errorRate) > 1 ? 'text-red-600' : 'text-slate-900'}`}>{conn.errorRate}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">Throughput</p>
                                                    <p className="text-2xl lg:text-3xl font-black text-slate-900">{conn.requests}</p>
                                                </div>
                                            </div>
                                            <div className="w-full h-32 bg-slate-50 rounded-lg border border-slate-100 flex items-end px-2 pt-4 pb-2 gap-1 overflow-hidden relative">
                                                <div className="absolute top-2 left-2 text-[10px] text-slate-400 font-bold uppercase">Requests / Min (Last 1hr)</div>
                                                {Array.from({ length: 30 }).map((_, i) => {
                                                    const isError = conn.status !== 'Operational' && Math.random() > 0.8;
                                                    const heightClass = `h-[${Math.floor(Math.random() * 80) + 10}%]`;
                                                    return (
                                                        <div key={i} className={`flex-1 rounded-t-sm ${isError ? 'bg-red-400' : 'bg-blue-400/80'} ${heightClass}`} style={{ height: `${Math.floor(Math.random() * 80) + 20}%` }}></div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* End-to-End Validation */}
                                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                            <h3 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
                                                <Terminal className="w-5 h-5 text-purple-600" /> End-to-End Validation
                                            </h3>
                                            <div className="bg-slate-900 rounded-lg p-4 font-mono text-[11px] lg:text-xs text-green-400 overflow-x-auto shadow-inner mb-4 h-48 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
                                                <p className="text-slate-500 mb-2"># Execute synthetic transaction test to validate connection</p>
                                                <p className="whitespace-nowrap">$ curl -X POST {conn.endpoint}</p>
                                                <p className="text-slate-300 whitespace-nowrap">  -H "Authorization: Bearer ***"</p>
                                                <p className="text-slate-300 whitespace-nowrap">  -H "Content-Type: application/json"</p>
                                                <p className="text-slate-300 whitespace-nowrap">  -d '{`{"health_check": true, "timestamp": "2026-03-08T10:00:00Z"}`}'</p>
                                                <br />
                                                {conn.status === 'Operational' ? (
                                                    <>
                                                        <p className="text-yellow-300 whitespace-nowrap">{`> HTTP/1.1 200 OK`}</p>
                                                        <p className="text-slate-300 whitespace-nowrap">{`> Date: Sun, 08 Mar 2026 10:00:01 GMT`}</p>
                                                        <p className="text-green-400 mt-2 whitespace-nowrap">{`{"status": "healthy", "service": "operational"}`}</p>
                                                    </>
                                                ) : (
                                                    <p className="text-red-400 whitespace-nowrap">{`> HTTP/1.1 503 Service Unavailable\n> Connection Timeout after 3000ms.`}</p>
                                                )}
                                            </div>
                                            <div className="flex justify-end">
                                                <button className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 shadow-sm flex items-center gap-2 transition-all">
                                                    <PlayCircle className="w-4 h-4" /> Run Synthetic Test
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
                                        {/* Webhooks Config */}
                                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                            <div className="flex justify-between items-center mb-5">
                                                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                                    <Globe className="w-5 h-5 text-emerald-600" /> Webhooks
                                                </h3>
                                                <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{conn.webhooks} Active</span>
                                            </div>
                                            {conn.webhooks > 0 ? (
                                                <ul className="space-y-3">
                                                    {[...Array(conn.webhooks)].map((_, i) => (
                                                        <li key={i} className="p-3 border border-slate-100 rounded-lg bg-slate-50 flex flex-col gap-2">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">POST</span>
                                                                <span className="text-[10px] font-medium text-slate-400">/v1/events/on_success</span>
                                                            </div>
                                                            <p className="text-xs font-medium text-slate-700 truncate" title="https://internal.nymcard.com/receiver">https://internal.nymcard.com/receiver</p>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div className="p-4 border border-dashed border-slate-200 rounded-lg bg-slate-50 text-center">
                                                    <p className="text-xs text-slate-500 font-medium">No active webhooks configured.</p>
                                                </div>
                                            )}
                                            <button className="w-full mt-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">Manage Webhooks</button>
                                        </div>

                                        {/* Access Controls */}
                                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex-1">
                                            <h3 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
                                                <Users className="w-5 h-5 text-orange-600" /> Access Controls
                                            </h3>
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800">Admin Role</p>
                                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-0.5">Full Read/Write/Revoke</p>
                                                    </div>
                                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                </div>
                                                <div className="flex justify-between items-center pb-3 border-b border-slate-100 opacity-50">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800">Analyst Role</p>
                                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-0.5">Read Logs Only</p>
                                                    </div>
                                                    <div className="w-8 h-4 bg-slate-200 rounded-full relative">
                                                        <div className="absolute left-1 top-1 w-2 h-2 bg-white rounded-full"></div>
                                                    </div>
                                                </div>
                                                <div className="pt-4">
                                                    <button className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-sm font-bold transition-colors flex justify-center items-center gap-2">
                                                        <ShieldAlert className="w-4 h-4" /> Revoke API Key
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })() : (
                        <div className="max-w-7xl mx-auto p-6 md:p-8 animate-in fade-in duration-300">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Integration Hub</h2>
                                    <p className="text-sm font-medium text-slate-500 mt-1">Manage external data sources, webhooks, and third-party APIs.</p>
                                </div>
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <button className="flex-1 md:flex-none flex justify-center items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-full text-sm font-bold shadow-sm transition-all duration-200">
                                        <Key className="w-4 h-4" /> Global Secrets
                                    </button>
                                    <button className="flex-1 md:flex-none flex justify-center items-center gap-2 bg-[#1d3557] hover:bg-blue-900 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                                        <Plus className="w-5 h-5" /> Add Connection
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-6">
                                {connections.map((conn) => (
                                    <div
                                        key={conn.id}
                                        onClick={() => setActiveConnectionId(conn.id)}
                                        className="col-span-12 md:col-span-6 lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-0 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 group cursor-pointer flex flex-col relative overflow-visible"
                                    >
                                        <div className="p-6 pb-5 flex-1 flex flex-col relative z-20 bg-white rounded-t-2xl">
                                            <div className="flex justify-between items-start mb-5">
                                                <div className="flex items-start gap-4 flex-1 pr-2">
                                                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                                                        {conn.icon}
                                                    </div>
                                                    <div className="flex-1 overflow-hidden min-w-0">
                                                        <h3 className="text-base font-black text-slate-900 leading-tight tracking-tight truncate" title={conn.name}>{conn.name}</h3>
                                                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mt-1 truncate">{conn.type}</p>
                                                    </div>
                                                </div>
                                                <div className="relative z-50">
                                                    <button
                                                        onClick={(e) => toggleActionMenu(e, conn.id)}
                                                        className={`p-1.5 rounded-md transition-colors ${actionMenuOpen === conn.id ? 'bg-slate-100 text-slate-800 ring-2 ring-blue-500 md:ring-0' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>

                                                    {actionMenuOpen === conn.id && (
                                                        <>
                                                            <div className="fixed inset-0 z-40 md:hidden" onClick={(e) => toggleActionMenu(e, conn.id)}></div>
                                                            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 origin-top-right">
                                                                <button onClick={(e) => { e.stopPropagation(); setActionMenuOpen(null); }} className="w-full text-left px-4 py-2.5 md:py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                                    <Edit3 className="w-4 h-4" /> Update Credentials
                                                                </button>
                                                                <button onClick={(e) => { e.stopPropagation(); setActionMenuOpen(null); }} className="w-full text-left px-4 py-2.5 md:py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                                    <Terminal className="w-4 h-4" /> Submit Config
                                                                </button>
                                                                <div className="h-px bg-slate-100 my-1"></div>
                                                                <button onClick={(e) => { e.stopPropagation(); setActionMenuOpen(null); }} className="w-full text-left px-4 py-2.5 md:py-2 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2">
                                                                    <Trash2 className="w-4 h-4" /> Revoke Access
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 mb-5 mt-auto">
                                                <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 relative group/tooltip">
                                                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Latency</p>
                                                    <p className={`text-sm font-black ${parseInt(conn.latency) > 500 ? 'text-orange-600' : 'text-slate-800'}`}>{conn.latency}</p>
                                                </div>
                                                <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 relative group/tooltip">
                                                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Error Rate</p>
                                                    <p className={`text-sm font-black ${parseFloat(conn.errorRate) > 1 ? 'text-red-600' : 'text-slate-800'}`}>{conn.errorRate}</p>
                                                </div>
                                            </div>

                                            <div className="bg-slate-900 rounded-lg p-2.5 flex items-center gap-2">
                                                <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0 mx-1" />
                                                <p className="text-[11px] font-mono text-slate-300 truncate pr-2 w-full select-all" title={conn.endpoint}>
                                                    {conn.endpoint}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50/80 rounded-b-2xl z-10">
                                            <div className="flex items-center gap-2.5 bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
                                                {getStatusIndicator(conn.status)}
                                                <span className={`text-[10px] uppercase font-bold tracking-wider ${conn.status === 'Operational' ? 'text-emerald-700' : (conn.status === 'Degraded' ? 'text-orange-700' : 'text-red-700')}`}>
                                                    {conn.status}
                                                </span>
                                            </div>
                                            <div className="text-[11px] font-bold text-blue-600 flex items-center gap-1.5 opacity-0 md:group-hover:opacity-100 md:translate-x-4 md:group-hover:translate-x-0 transition-all duration-300 md:opacity-100 md:translate-x-0 md:bg-white md:px-3 md:py-1 md:rounded-full md:border md:border-blue-200 md:shadow-sm">
                                                Configure <ArrowRightLeft className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="fixed bottom-0 left-0 right-0 h-10 bg-[#112240] flex items-center px-6 z-50">
                        <p className="text-[11px] text-slate-400 font-medium">© 2026 NymCard - Decision Engine Platform</p>
                    </div>
                </main>
            </div>
        </div>
    );
}
