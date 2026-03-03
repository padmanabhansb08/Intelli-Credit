import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Play, Building2, Share2, AlertTriangle, FileText, CheckCircle2, RefreshCw } from 'lucide-react';

// Reusable animated handle with visual type-checking (colored by type)
const CustomHandle = ({ type, position, colorClass, id }) => (
    <Handle
        type={type}
        position={position}
        id={id}
        className={`w-3 h-3 ${colorClass} border-2 border-white transition-all hover:scale-125 z-50`}
    />
);

export const TriggerNode = memo(({ data, selected }) => {
    return (
        <div className={`relative flex flex-col items-center bg-white p-4 rounded-xl shadow-lg border-2 ${selected ? 'border-emerald-500 shadow-emerald-500/20' : 'border-slate-100'} transition-all`}>
            <div className="w-12 h-12 rounded-full bg-emerald-500 shadow-emerald-500/40 shadow-inner flex items-center justify-center text-white mb-3">
                <Play className="w-6 h-6 fill-current ml-1" />
            </div>
            <span className="text-sm font-bold text-slate-700">{data.label}</span>
            <span className="text-xs text-slate-400 mt-1 font-medium tracking-wide uppercase">Initiation</span>
            <CustomHandle type="source" position={Position.Bottom} colorClass="bg-emerald-500" />
        </div>
    );
});

export const DocumentClassificationNode = memo(({ data, selected }) => {
    return (
        <div className={`relative w-80 bg-white/80 backdrop-blur-md rounded-xl shadow-xl border-2 ${selected ? 'border-purple-500 shadow-purple-500/20' : 'border-slate-200'} p-0 overflow-hidden text-left transition-all group`}>
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0 backdrop-blur-sm shadow-sm">
                    <FileText className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-white flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-200">IDP Extraction</span>
                    <span className="text-sm font-bold shadow-sm">{data.label || 'Document Classifier'}</span>
                </div>
                {/* Confidence Badge */}
                {data.confidence && (
                    <div className="bg-emerald-400/20 border border-emerald-400/30 px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-md shadow-sm">
                        <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                        <span className="text-xs font-bold text-emerald-100">{data.confidence}%</span>
                    </div>
                )}
            </div>

            {/* Error State with CTA */}
            {data.error && (
                <div className="bg-rose-50 border-b border-rose-100 p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-xs text-rose-700 font-medium">{data.error}</p>
                        <button className="mt-2 text-xs bg-white border border-rose-200 text-rose-600 px-3 py-1.5 rounded-md font-bold flex items-center gap-1 hover:bg-rose-100 transition-colors shadow-sm">
                            <RefreshCw className="w-3 h-3" /> Re-upload Document
                        </button>
                    </div>
                </div>
            )}

            {/* Miniature Data Table Preview */}
            {!data.error && data.extractedFields && (
                <div className="p-3 bg-slate-50 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 mb-2 block">Extracted Entities</span>
                    <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-sm">
                        {data.extractedFields.map((field, idx) => (
                            <div key={idx} className={`flex justify-between p-1.5 px-3 text-xs ${idx !== data.extractedFields.length - 1 ? 'border-b border-slate-100' : ''}`}>
                                <span className="text-slate-500 font-medium">{field.key}</span>
                                <span className="text-slate-800 font-bold font-mono">{field.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="p-2 bg-white flex justify-between items-center px-4">
                <span className="text-[10px] text-slate-400 font-medium">Model: <span className="text-slate-600 font-bold">SciBERT+Flan-T5</span></span>
            </div>

            <CustomHandle type="target" position={Position.Top} colorClass="bg-emerald-500" />
            <CustomHandle type="source" position={Position.Bottom} colorClass="bg-purple-500" />
        </div>
    );
});

export const IntegrationNode = memo(({ data, selected }) => {
    return (
        <div className={`relative w-72 bg-white rounded-xl shadow-lg border-2 ${selected ? 'border-blue-500 shadow-blue-500/20 ring-4 ring-blue-500/10' : 'border-slate-200'} flex items-stretch overflow-hidden transition-all text-left`}>

            {/* Color Bar indicator */}
            <div className="w-2 bg-blue-500 shrink-0"></div>

            <div className="p-3 flex-1 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-inner">
                        <Building2 className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs text-blue-500 font-bold uppercase tracking-wider">{data.connection || 'API Gateway'}</span>
                        <span className="text-sm font-bold text-slate-800">{data.label}</span>
                    </div>
                </div>

                {data.warning && (
                    <div className="mt-2 bg-orange-50 border border-orange-200 rounded-md p-2 flex gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                        <span className="text-xs text-orange-700 font-medium">{data.warningDetails || 'High latency detected in downstream system.'}</span>
                    </div>
                )}
            </div>

            <CustomHandle type="target" position={Position.Top} colorClass="bg-purple-500" />
            <CustomHandle type="source" position={Position.Bottom} colorClass="bg-blue-500" />
        </div>
    );
});

export const ConditionNode = memo(({ data, selected }) => {
    return (
        <div className={`relative w-64 bg-slate-900 rounded-xl shadow-2xl border-2 ${selected ? 'border-pink-500 shadow-pink-500/30' : 'border-slate-700'} p-4 flex flex-col transition-all text-left`}>

            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white shrink-0 shadow-lg">
                    <Share2 className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-pink-400 font-bold uppercase tracking-widest">Routing Logic</span>
                    <span className="text-sm font-bold text-white">{data.label}</span>
                </div>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700">
                <span className="text-xs text-slate-300 font-mono break-all">{data.assignmentDetails}</span>
            </div>

            <CustomHandle type="target" position={Position.Top} colorClass="bg-blue-500" />

            {/* Multiple custom source handles for branching paths */}
            <CustomHandle type="source" position={Position.Bottom} id="true" colorClass="bg-emerald-500 left-1/3" />
            <CustomHandle type="source" position={Position.Bottom} id="false" colorClass="bg-rose-500 left-2/3" />

            <div className="absolute -bottom-6 w-full flex justify-between px-8 text-[10px] font-bold opacity-75">
                <span className="text-emerald-500 drop-shadow-sm">TRUE</span>
                <span className="text-rose-500 drop-shadow-sm">FALSE</span>
            </div>
        </div>
    );
});

export const ExplainableAINode = memo(({ data, selected }) => {
    return (
        <div className={`relative w-80 bg-white rounded-xl shadow-xl border-2 ${selected ? 'border-amber-500 shadow-amber-500/20' : 'border-slate-200'} p-0 overflow-hidden text-left transition-all`}>

            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0 shadow-sm">
                    <Share2 className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-white">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Interpretability</span>
                    <span className="text-sm font-bold shadow-sm">{data.label || 'TreeSHAP Explainer'}</span>
                </div>
            </div>

            {/* TreeSHAP Contribution Matrix Preview */}
            <div className="p-3 bg-slate-50">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-slate-500 block">Feature Impact Matrix</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">Platt Calibrated</span>
                </div>

                {data.shapValues && (
                    <div className="flex flex-col gap-1.5">
                        {data.shapValues.map((feature, idx) => (
                            <div key={idx} className="flex flex-col">
                                <div className="flex justify-between text-[10px] font-medium mb-0.5">
                                    <span className="text-slate-600">{feature.name}</span>
                                    <span className={feature.impact > 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>
                                        {feature.impact > 0 ? '+' : ''}{feature.impact.toFixed(2)}
                                    </span>
                                </div>
                                {/* Bar visualization */}
                                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
                                    <div
                                        className={`h-full ${feature.impact > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${Math.min(Math.abs(feature.impact) * 20, 100)}%`, marginLeft: feature.impact > 0 ? '50%' : `${50 - Math.min(Math.abs(feature.impact) * 20, 50)}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-2 border-t border-slate-100 bg-white flex justify-between items-center px-4">
                <span className="text-[10px] text-slate-400 font-medium">Model: <span className="text-slate-600 font-bold">XGBoost (Credit Risk)</span></span>
            </div>

            <CustomHandle type="target" position={Position.Top} colorClass="bg-blue-500" />
            <CustomHandle type="source" position={Position.Bottom} colorClass="bg-amber-500" />
        </div>
    );
});
