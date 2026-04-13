'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    ShieldAlert,
    Clock,
    CheckCircle2,
    XCircle,
    ChevronRight,
    Filter,
    Search,
    RefreshCw,
} from 'lucide-react';
import NextLink from 'next/link';
import { formatDistanceToNow } from 'date-fns';

const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010/api';

const STATUS_CONFIG = {
    PENDING: {
        icon: Clock,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        label: 'Pending Review'
    },
    APPROVED: {
        icon: CheckCircle2,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        label: 'Approved'
    },
    REJECTED: {
        icon: XCircle,
        color: 'text-rose-600',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        label: 'Rejected'
    }
};

export default function ReviewDashboard() {
    const { user } = useAuth();
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState(''); // '' means all

    const fetchRequests = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        setError(null);
        try {
            const token = await user.getIdToken();
            let url = `${NEXT_PUBLIC_API_URL}/v2/approvals?page=1&page_size=50`;
            if (statusFilter) {
                url += `&status_filter=${statusFilter}`;
            }

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setRequests(data.items || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [user, statusFilter]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center border border-violet-200 shadow-inner">
                        <ShieldAlert className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900">Review Station</h1>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-0.5">Policy Maker-Checker Queue</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search policies..."
                            className="pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 w-64 shadow-sm"
                        />
                    </div>

                    <div className="relative flex items-center">
                        <Filter className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="appearance-none pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 cursor-pointer shadow-sm hover:bg-slate-50 transition-colors"
                        >
                            <option value="">All Statuses</option>
                            <option value="PENDING">Pending Review</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>

                    <button
                        onClick={fetchRequests}
                        disabled={isLoading}
                        className="p-2 text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors border border-transparent hover:border-violet-200"
                        title="Refresh list"
                    >
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin text-violet-600' : ''}`} />
                    </button>
                </div>
            </header>

            {/* ── Main Content ────────────────────────────────────────────────── */}
            <main className="max-w-6xl mx-auto px-8 pt-8">
                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-700">
                        <ShieldAlert className="w-5 h-5" />
                        <p className="text-sm font-semibold">Failed to load requests: {error}</p>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                        <div className="col-span-4">Policy Configuration</div>
                        <div className="col-span-3">Status</div>
                        <div className="col-span-3">Maker (Requested By)</div>
                        <div className="col-span-2 text-right">Age</div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-slate-100">
                        {isLoading && requests.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                                <RefreshCw className="w-8 h-8 animate-spin mb-4 text-violet-300" />
                                <p className="text-sm font-medium">Loading approval queue...</p>
                            </div>
                        ) : requests.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                                <ShieldAlert className="w-12 h-12 mb-4 text-slate-200" />
                                <p className="text-base font-semibold text-slate-600">No requests found</p>
                                <p className="text-sm mt-1">Adjust filters or submit a new policy draft.</p>
                            </div>
                        ) : (
                            requests.map((req) => {
                                const conf = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING;
                                const StatusIcon = conf.icon;

                                return (
                                    <NextLink
                                        href={`/review/${req.id}`}
                                        key={req.id}
                                        className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50/80 transition-colors group cursor-pointer"
                                    >
                                        {/* Policy Info */}
                                        <div className="col-span-4 flex flex-col">
                                            <span className="text-sm font-bold text-slate-900 group-hover:text-violet-700 transition-colors">{req.policy_name}</span>
                                            <span className="text-xs text-slate-500 font-medium mt-0.5">Version {req.policy_version}</span>
                                        </div>

                                        {/* Status Badge */}
                                        <div className="col-span-3 flex items-center">
                                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${conf.bg} ${conf.border} ${conf.color}`}>
                                                <StatusIcon className="w-3.5 h-3.5" />
                                                <span className="text-xs font-bold tracking-wide">{conf.label}</span>
                                            </div>
                                        </div>

                                        {/* Requester */}
                                        <div className="col-span-3 flex flex-col truncate pr-4">
                                            <span className="text-sm text-slate-700 font-medium truncate">{req.requester_email}</span>
                                            <span className="text-[10px] text-slate-400 font-mono truncate">{req.requested_by.split('-')[0]}...</span>
                                        </div>

                                        {/* Age & Action */}
                                        <div className="col-span-2 flex items-center justify-end gap-3 text-right">
                                            <span className="text-xs text-slate-500 font-medium">
                                                {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                                            </span>
                                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all" />
                                        </div>
                                    </NextLink>
                                );
                            })
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
