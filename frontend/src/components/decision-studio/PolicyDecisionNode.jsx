'use client';
import React, { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

const DECISION_OPTIONS = [
    { value: 'APPROVE', label: 'Approve', icon: CheckCircle2, color: 'primary' },
    { value: 'REJECT', label: 'Reject', icon: XCircle, color: 'secondary' },
    { value: 'MANUAL_REVIEW', label: 'Manual Review', icon: AlertTriangle, color: 'tertiary' },
];

const colorMap = {
    primary: {
        bg: 'bg-white',
        border: 'border-white',
        text: 'text-black',
        ring: 'ring-white/20 border-white/50',
    },
    secondary: {
        bg: 'bg-gray-800',
        border: 'border-gray-700',
        text: 'text-gray-300',
        ring: 'ring-gray-700/50 border-gray-700/50',
    },
    tertiary: {
        bg: 'bg-gray-600',
        border: 'border-gray-500',
        text: 'text-white',
        ring: 'ring-gray-600/50 border-gray-600/50',
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
        <div className={`relative w-64 bg-[#1a1a24] text-white rounded-2xl shadow-lg border-2 transition-all
      ${selected ? `shadow-xl ring-2 ${colors.ring}` : 'border-gray-800 hover:border-gray-700'}`}
        >
            {/* Header */}
            <div className={`bg-[#111111] border-b border-gray-800 rounded-t-[14px] px-4 py-3 flex items-center gap-3`}>
                <div className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center backdrop-blur-sm">
                    <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex flex-col text-white">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Terminal</span>
                    <span className="text-sm font-semibold">{option.label}</span>
                </div>
            </div>

            {/* Controls */}
            <div className="p-4 flex flex-col gap-3">
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">Decision</label>
                    <select
                        value={data.decision || 'MANUAL_REVIEW'}
                        onChange={onDecisionChange}
                        className="w-full bg-[#111111] border border-gray-800 rounded-lg px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-1 focus:ring-white focus:border-transparent transition-all cursor-pointer [&>option]:bg-[#1a1a24]"
                    >
                        {DECISION_OPTIONS.map(d => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">Reason</label>
                    <textarea
                        value={data.reason || ''}
                        onChange={onReasonChange}
                        placeholder="Explainability reason..."
                        rows={2}
                        className="w-full bg-[#111111] border border-gray-800 rounded-lg px-3 py-2 text-xs font-medium text-white placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-white focus:border-transparent transition-all resize-none"
                    />
                </div>
            </div>

            {/* Handle */}
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-500 !border-2 !border-[#1a1a24]" />
        </div>
    );
}

export default memo(PolicyDecisionNode);
