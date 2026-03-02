import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Play, Building2, Share2, AlertTriangle } from 'lucide-react';

export const TriggerNode = memo(({ data }) => {
    return (
        <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-emerald-500 shadow-md flex items-center justify-center text-white mb-2 pb-0.5 pr-0.5">
                <Play className="w-5 h-5 fill-current" />
            </div>
            <span className="text-sm font-semibold text-slate-700">{data.label}</span>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-300 border-2 border-white translate-y-2 opacity-0" />
            <div className="absolute -bottom-4 w-4 h-4 rounded-full bg-slate-200 border-2 border-white z-10 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-slate-400"></div>
            </div>
        </div>
    );
});

export const IntegrationNode = memo(({ data, selected }) => {
    return (
        <div className={`relative w-64 bg-white rounded-lg shadow-sm border ${selected ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20' : 'border-slate-200'} p-3 flex items-center gap-3 transition-colors`}>

            {/* Warning Indicator */}
            {data.warning && (
                <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-orange-100 border-2 border-white flex items-center justify-center text-orange-500 shadow-sm z-20">
                    <AlertTriangle className="w-3 h-3" />
                </div>
            )}

            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-300 border-2 border-white -translate-y-1.5 opacity-0 cursor-crosshair" />
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-200 border-2 border-white z-10 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-slate-400"></div>
            </div>

            <div className="w-10 h-10 rounded-md bg-teal-500 flex items-center justify-center text-white shrink-0">
                <Building2 className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
                <span className="text-xs text-slate-500 font-medium">{data.connection || 'Integration'}</span>
                <span className="text-sm font-bold text-slate-800">{data.label}</span>
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-300 border-2 border-white translate-y-1.5 opacity-0 cursor-crosshair" />
            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-slate-200 z-10 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full border border-slate-300"></div>
            </div>
        </div>
    );
});

export const ConditionNode = memo(({ data, selected }) => {
    return (
        <div className={`relative w-64 bg-white rounded-lg shadow-sm border ${selected ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20' : 'border-slate-200'} p-3 flex items-center gap-3 transition-colors`}>

            {data.warning && (
                <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-orange-100 border-2 border-white flex items-center justify-center text-orange-500 shadow-sm z-20">
                    <AlertTriangle className="w-3 h-3" />
                </div>
            )}

            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-300 border-2 border-white -translate-y-1.5 opacity-0 cursor-crosshair" />
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-200 border-2 border-white z-10 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-slate-400"></div>
            </div>

            <div className="w-10 h-10 rounded-md bg-indigo-500 flex items-center justify-center text-white shrink-0">
                <Share2 className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
                <span className="text-xs text-slate-500 font-medium">{data.label}</span>
                <span className="text-sm font-bold text-slate-800">{data.assignmentDetails}</span>
            </div>

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-300 border-2 border-white translate-y-1.5 opacity-0 cursor-crosshair" />
            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-slate-200 z-10 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full border border-slate-300"></div>
            </div>
        </div>
    );
});
