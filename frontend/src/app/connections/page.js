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
    MoreVertical
} from 'lucide-react';
import NextLink from 'next/link';

export default function ConnectionsDashboard() {
    const [activeTab, setActiveTab] = useState('connections');

    const connections = [
        {
            id: 1,
            name: "Open AI",
            type: "AI Service",
            status: "Connected",
            icon: <Hexagon className="w-6 h-6 text-slate-700" />
        },
        {
            id: 2,
            name: "Credit Bureau",
            type: "Financial",
            status: "Connected",
            icon: <Building2 className="w-6 h-6 text-blue-600" />
        },
        {
            id: 3,
            name: "PostgreSQL",
            type: "Database",
            status: "Connected",
            icon: <Database className="w-6 h-6 text-indigo-600" />
        },
        {
            id: 4,
            name: "Threat Matrix",
            type: "Security",
            status: "Connected",
            icon: <ShieldAlert className="w-6 h-6 text-orange-600" />
        },
        {
            id: 5,
            name: "HTTP API",
            type: "Integration",
            status: "Disconnected",
            icon: <Globe className="w-6 h-6 text-purple-600" />
        },
        {
            id: 6,
            name: "Anthropic",
            type: "AI Service",
            status: "Disconnected",
            icon: <Cpu className="w-6 h-6 text-slate-800" />
        }
    ];

    return (
        // Overlaying the root layout to provide the pure Apple-esque light mode experience
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
                        <span className="text-xs text-slate-500 font-medium leading-tight">admin</span>
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
                        <NextLink
                            href="/studio"
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'studio' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                        >
                            <Network className="w-4 h-4" />
                            Decision Studio
                        </NextLink>

                        <NextLink
                            href="/connections"
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'connections' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                        >
                            <ArrowRightLeft className="w-4 h-4" />
                            Connections
                        </NextLink>

                        <NextLink
                            href="#"
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'review' ? 'bg-white text-blue-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                        >
                            <FileCheck className="w-4 h-4" />
                            Review Station
                        </NextLink>
                    </nav>

                    <div className="px-6 mt-10 mb-2">
                        <h2 className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-4">Other</h2>
                    </div>

                    <nav className="flex flex-col gap-1 px-3">
                        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                            <Settings className="w-4 h-4" />
                            Settings
                        </button>
                        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                            <LogOut className="w-4 h-4" />
                            Logout
                        </button>
                    </nav>
                </aside>

                {/* Dashboard View */}
                <main className="flex-1 bg-[#F1F5F9] overflow-y-auto">
                    <div className="max-w-6xl mx-auto p-8">

                        {/* Header */}
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-xl font-bold text-slate-800">Connections</h2>
                            <button className="flex items-center gap-2 bg-[#1d3557] hover:bg-blue-900 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-sm transition-all hover:shadow-md">
                                <Plus className="w-4 h-4" />
                                Add Connection
                            </button>
                        </div>

                        {/* Bento-Box Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {connections.map((conn) => (
                                <div key={conn.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow group cursor-pointer flex flex-col">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                                                {conn.icon}
                                            </div>
                                            <div>
                                                <h3 className="text-base font-bold text-slate-800 leading-tight">{conn.name}</h3>
                                                <p className="text-xs text-slate-500 font-medium mt-0.5">{conn.type}</p>
                                            </div>
                                        </div>
                                        <button className="text-slate-300 hover:text-slate-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="mt-auto border-t border-slate-100 pt-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="relative flex h-2.5 w-2.5">
                                                {conn.status === 'Connected' ? (
                                                    <>
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20"></span>
                                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                                    </>
                                                ) : (
                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                                )}
                                            </span>
                                            <span className={`text-xs font-semibold ${conn.status === 'Connected' ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {conn.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>

                    {/* Bottom Footer Ribbon */}
                    <div className="fixed bottom-0 left-0 right-0 h-10 bg-[#112240] flex items-center px-6 z-50">
                        <p className="text-[11px] text-slate-400 font-medium">© 2026 NymCard - Credit Decision Engine</p>
                    </div>
                </main>
            </div>
        </div>
    );
}
