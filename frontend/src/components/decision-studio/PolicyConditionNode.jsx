'use client';
import React, { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

const FINANCIAL_ATTRIBUTES = [
    { value: 'revenue', label: 'Revenue' },
    { value: 'ebitda', label: 'EBITDA' },
    { value: 'total_debt', label: 'Total Debt' },
    { value: 'net_worth', label: 'Net Worth' },
    { value: 'dscr', label: 'DSCR' },
    { value: 'debt_equity_ratio', label: 'Debt-to-Equity' },
    { value: 'current_ratio', label: 'Current Ratio' },
    { value: 'bureau_score', label: 'Bureau Score' },
    { value: 'interest_coverage', label: 'Interest Coverage' },
    { value: 'operating_margin', label: 'Operating Margin' },
    { value: 'leverage_ratio', label: 'Leverage Ratio' },
];

const OPERATORS = [
    { value: '>', label: '>' },
    { value: '>=', label: '>=' },
    { value: '<', label: '<' },
    { value: '<=', label: '<=' },
    { value: '==', label: '==' },
    { value: '!=', label: '!=' },
];

function PolicyConditionNode({ id, data, selected }) {
    const onFieldChange = useCallback((e) => {
        data.onUpdate?.(id, { ...data, field: e.target.value });
    }, [id, data]);

    const onOperatorChange = useCallback((e) => {
        data.onUpdate?.(id, { ...data, operator: e.target.value });
    }, [id, data]);

    const onValueChange = useCallback((e) => {
        const raw = e.target.value;
        const sanitized = raw.replace(/[^0-9.\-]/g, '');
        data.onUpdate?.(id, { ...data, value: sanitized });
    }, [id, data]);

    return (
        <div className={`relative w-72 bg-white rounded-2xl shadow-lg border-2 transition-all
      ${selected ? 'border-blue-500 shadow-blue-100 ring-2 ring-blue-200/50' : 'border-slate-200 hover:border-slate-300'}`}
        >
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-t-[14px] px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <GitBranch className="w-4 h-4 text-white" />
                </div>
                <div className="flex flex-col text-white">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Condition</span>
                    <span className="text-sm font-semibold">{data.label || 'Rule Node'}</span>
                </div>
            </div>

            {/* Controls */}
            <div className="p-4 flex flex-col gap-3">
                {/* Financial Attribute Dropdown */}
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Attribute</label>
                    <select
                        value={data.field || ''}
                        onChange={onFieldChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all cursor-pointer"
                    >
                        <option value="" disabled>Select attribute…</option>
                        {FINANCIAL_ATTRIBUTES.map(attr => (
                            <option key={attr.value} value={attr.value}>{attr.label}</option>
                        ))}
                    </select>
                </div>

                {/* Operator Dropdown */}
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Operator</label>
                    <select
                        value={data.operator || '>='}
                        onChange={onOperatorChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all cursor-pointer"
                    >
                        {OPERATORS.map(op => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                    </select>
                </div>

                {/* Threshold Value Input */}
                <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Threshold</label>
                    <input
                        type="text"
                        value={data.value ?? ''}
                        onChange={onValueChange}
                        placeholder="e.g. 1.25"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
                    />
                </div>

                {/* Expression Preview */}
                <div className="bg-slate-900 rounded-lg px-3 py-2 mt-1">
                    <code className="text-xs text-emerald-400 font-mono">
                        {data.field || '???'} {data.operator || '>='} {data.value || '???'}
                    </code>
                </div>
            </div>

            {/* TRUE / FALSE labels */}
            <div className="absolute -bottom-7 w-full flex justify-between px-10 text-[9px] font-bold uppercase tracking-widest">
                <span className="text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">TRUE</span>
                <span className="text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">FALSE</span>
            </div>

            {/* Handles */}
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-violet-500 !border-2 !border-white" />
            <Handle type="source" position={Position.Bottom} id="on_true" className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white" style={{ left: '30%' }} />
            <Handle type="source" position={Position.Bottom} id="on_false" className="!w-3 !h-3 !bg-rose-500 !border-2 !border-white" style={{ left: '70%' }} />
        </div>
    );
}

export default memo(PolicyConditionNode);
export { FINANCIAL_ATTRIBUTES, OPERATORS };
