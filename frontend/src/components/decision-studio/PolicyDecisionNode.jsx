'use client';
import React, { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

const DECISION_OPTIONS = [
    { value: 'APPROVE', label: 'Approve', icon: CheckCircle2, color: 'emerald' },
    { value: 'REJECT', label: 'Reject', icon: XCircle, color: 'rose' },
    { value: 'MANUAL_REVIEW', label: 'Manual Review', icon: AlertTriangle, color: 'amber' },
];

const colorMap = {
    emerald: {
        gradient: 'from-emerald-600 to-emerald-500',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-700',
        ring: 'ring-emerald-200/50 border-emerald-400',
    },
    rose: {
        gradient: 'from-rose-600 to-rose-500',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        text: 'text-rose-700',
        ring: 'ring-rose-200/50 border-rose-400',
    },
    amber: {
        gradient: 'from-amber-600 to-amber-500',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-700',
        ring: 'ring-amber-200/50 border-amber-400',
    },
};

function PolicyDecisionNode({ id, data, selected }) {
    const option = DECISION_OPTIONS.find(o => o.value === data.decision) || DECISION_OPTIONS[2];
    const colors = colorMap[option.color];
    const Icon = option.icon;

    const onDecisionChange = useCallback((e) => {
        data.onUpdate?.(id, { ...data, decision: e.target.value });
    }, [id, data]);

    const onReasonChange = useCallback((e) => {
        data.onUpdate?.(id, { ...data, reason: e.target.value });
    }, [id, data]);

    return (
        <div className={`relative w-64 bg-white rounded-2xl shadow-lg border-2 transition-all
      ${selected ? `shadow-xl ring-2 ${colors.ring}` : 'border-slate-200 hover:border-slate-300'}`}
        >
            {/* Header */}
            <div className={`bg-gradient-to-r ${colors.gradient} rounded-t-[14px] px-4 py-3 flex items-center gap-3`}>
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex flex-col text-white">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Terminal</span>
                    <span className="text-sm font-semibold">{option.label}</span>
                </div>
            </div>

            {/* Controls */}
            <div className="p-4 flex flex-col gap-3">
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Decision</label>
                    <select
                        value={data.decision || 'MANUAL_REVIEW'}
                        onChange={onDecisionChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all cursor-pointer"
                    >
                        {DECISION_OPTIONS.map(d => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Reason</label>
                    <textarea
                        value={data.reason || ''}
                        onChange={onReasonChange}
                        placeholder="Explainability reason..."
                        rows={2}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all resize-none"
                    />
                </div>
            </div>

            {/* Handle */}
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-slate-500 !border-2 !border-white" />
        </div>
    );
}

export default memo(PolicyDecisionNode);
