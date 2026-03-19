'use client';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth, UserRole } from '../../../context/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import {
    ShieldAlert,
    Clock,
    CheckCircle2,
    XCircle,
    ArrowLeft,
    GitPullRequest,
    User,
    CheckCircle,
    XOctagon,
    Loader2,
    AlertCircle
} from 'lucide-react';
import NextLink from 'next/link';
import { format } from 'date-fns';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { motion, AnimatePresence } from 'framer-motion';

const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const STATUS_CONFIG = {
    PENDING: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200', label: 'Pending Review' },
    APPROVED: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200', label: 'Approved' },
    REJECTED: { icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-100', border: 'border-rose-200', label: 'Rejected' }
};

export default function ReviewDetail() {
    const { id } = useParams();
    const router = useRouter();
    const { user, userRole } = useAuth();

    const [requestObj, setRequestObj] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [comments, setComments] = useState('');
    const [toast, setToast] = useState(null);

    const fetchRequest = useCallback(async () => {
        if (!user || !id) return;
        setIsLoading(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${NEXT_PUBLIC_API_URL}/v2/approvals/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setRequestObj(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [user, id]);

    useEffect(() => {
        fetchRequest();
    }, [fetchRequest]);

    const showToast = useCallback((type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const handleAction = async (actionType) => {
        if (!user) return;
        setActionLoading(actionType);
        try {
            const token = await user.getIdToken();
            const endpoint = actionType === 'APPROVE' ? 'approve' : 'reject';
            const res = await fetch(`${NEXT_PUBLIC_API_URL}/v2/approvals/${endpoint}/${id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                    'Idempotency-Key': `review-${id}-${actionType}-${Date.now()}`
                },
                body: JSON.stringify({ comments })
            });

            if (res.ok) {
                showToast('success', `Policy successfully ${actionType.toLowerCase()}d!`);
                await fetchRequest();
            } else if (res.status === 403) {
                showToast('error', 'Forbidden: You cannot approve your own submission or lack required roles.');
            } else {
                const err = await res.json();
                showToast('error', `Error: ${err.detail || res.statusText}`);
            }
        } catch (err) {
            showToast('error', `Network error: ${err.message}`);
        } finally {
            setActionLoading(false);
            setComments('');
        }
    };

    // RBAC Enforcement — Only CHECKERs can approve/reject, and Maker != Approver
    const canReview = useMemo(() => {
        if (!user || !requestObj) return false;
        if (requestObj.status !== 'PENDING') return false;

        // Check role
        const isCheckerOrAdmin = userRole === UserRole.CHECKER || userRole === UserRole.ADMIN;

        // Prevent self-approval: User ID (firebase uid) must not match requester UUID
        // Note: The backend enforces this strictly using the database UUID mapping, 
        // but we do a client side check based on the email to hide the buttons as a UI aid.
        const isNotSelf = user.email !== requestObj.requester_email;

        return isCheckerOrAdmin && isNotSelf;
    }, [user, userRole, requestObj]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-violet-600 mb-4" />
                <p className="text-sm font-semibold text-slate-500">Loading policy review...</p>
            </div>
        );
    }

    if (error || !requestObj) {
        return (
            <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center">
                <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
                <h2 className="text-xl font-bold text-slate-800">Failed to load request</h2>
                <p className="text-slate-500 mt-2">{error}</p>
                <NextLink href="/review" className="mt-6 text-violet-600 font-semibold hover:underline">← Back to Queue</NextLink>
            </div>
        );
    }

    const conf = STATUS_CONFIG[requestObj.status] || STATUS_CONFIG.PENDING;
    const StatusIcon = conf.icon;
    const oldJsonStr = requestObj.old_policy ? JSON.stringify(requestObj.old_policy, null, 2) : '{}';
    const newJsonStr = JSON.stringify(requestObj.new_policy, null, 2);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-4">
                    <NextLink href="/review" className="p-2 -ml-2 text-slate-400 hover:text-slate-800 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </NextLink>
                    <div className="h-6 w-px bg-slate-200 mx-2" />
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center border border-violet-200 shadow-inner">
                        <GitPullRequest className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900">
                            {requestObj.new_policy?.name || 'Policy Review'}
                        </h1>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs font-mono text-slate-500">v{requestObj.new_policy?.version || 1}</span>
                            <span className="text-[10px] text-slate-300">•</span>
                            <span className="text-xs font-medium text-slate-500">Req: {id.split('-')[0]}</span>
                        </div>
                    </div>
                </div>

                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm ${conf.bg} ${conf.border} ${conf.color}`}>
                    <StatusIcon className="w-4 h-4" />
                    <span className="text-sm font-bold tracking-wide">{conf.label}</span>
                </div>
            </header>

            {/* ── Main Content ────────────────────────────────────────────────── */}
            <main className="max-w-7xl mx-auto px-8 pt-6">

                {/* Meta Info Cards */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                            <User className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Maker (Requested By)</p>
                            <p className="text-sm font-semibold text-slate-800 mt-1">{requestObj.requester_email}</p>
                            <p className="text-xs font-mono text-slate-500 mt-0.5">{requestObj.requested_by}</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                            <Clock className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Timeline</p>
                            <p className="text-sm font-semibold text-slate-800 mt-1">Submitted: {format(new Date(requestObj.created_at), 'PPpp')}</p>
                        </div>
                    </div>
                </div>

                {/* Diff Viewer */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
                    <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-slate-50">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                            <GitPullRequest className="w-4 h-4" /> Configuration Diff
                        </h3>
                        <div className="flex gap-6 text-xs font-mono font-medium">
                            <span className="text-rose-600">Old (Active) Configuration</span>
                            <span className="text-emerald-600">New (Draft) Configuration</span>
                        </div>
                    </div>
                    <div className="text-[13px]">
                        <ReactDiffViewer
                            oldValue={oldJsonStr}
                            newValue={newJsonStr}
                            splitView={true}
                            useDarkTheme={false}
                            leftTitle={`v${requestObj.old_policy?.version || ' (None)'}`}
                            rightTitle={`v${requestObj.new_policy?.version}`}
                            styles={{
                                variables: {
                                    light: {
                                        diffViewerBackground: '#fff',
                                        diffViewerColor: '#334155',
                                        addedBackground: '#ecfdf5',
                                        addedColor: '#065f46',
                                        removedBackground: '#fff1f2',
                                        removedColor: '#9f1239',
                                        wordAddedBackground: '#a7f3d0',
                                        wordRemovedBackground: '#fecdd3',
                                    }
                                }
                            }}
                        />
                    </div>
                </div>

                {/* Action Area — STRICTLY RBAC GUARDED */}
                {canReview && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-violet-500" />
                            Checker Decision
                        </h3>

                        <textarea
                            className="w-full h-24 p-4 text-sm font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all placeholder:text-slate-400 resize-none mb-6"
                            placeholder="Add review comments or explain rejection..."
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                        />

                        <div className="flex items-center justify-end gap-4">
                            <button
                                onClick={() => handleAction('REJECT')}
                                disabled={actionLoading}
                                className="px-6 py-2.5 rounded-xl border-2 border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-sm shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {actionLoading === 'REJECT' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XOctagon className="w-4 h-4" />}
                                Reject Policy
                            </button>

                            <button
                                onClick={() => handleAction('APPROVE')}
                                disabled={actionLoading}
                                className="px-8 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {actionLoading === 'APPROVE' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                Approve & Activate
                            </button>
                        </div>
                    </div>
                )}

                {/* Warning if Maker tries to view their own pending request */}
                {requestObj.status === 'PENDING' && !canReview && userRole === UserRole.MAKER && (
                    <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 flex items-center gap-3">
                        <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
                        <p className="text-sm font-medium text-amber-800">
                            <strong>Maker-Checker Guard:</strong> You are viewing a pending request. Only a designated Checker can approve or reject this policy.
                        </p>
                    </div>
                )}

            </main>

            {/* ── Toast ────────────────────────────────────────────────────────── */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-semibold backdrop-blur-md border
               ${toast.type === 'success'
                                ? 'bg-emerald-500/90 text-white border-emerald-400/30'
                                : 'bg-rose-500/90 text-white border-rose-400/30'
                            }`}
                    >
                        {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
