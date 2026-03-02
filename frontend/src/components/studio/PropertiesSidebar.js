"use client";

import React from 'react';
import useWorkflowStore from '@/store/useWorkflowStore';
import { Share2, Building2, ChevronLeft, PlusCircle, Trash2, ChevronDown } from 'lucide-react';

export default function PropertiesSidebar() {
    const { nodes, selectedNodeId, updateNodeData, openMappingModal, setSelectedNodeId } = useWorkflowStore();

    if (!selectedNodeId) return null;

    const activeNode = nodes.find(n => n.id === selectedNodeId);
    if (!activeNode) return null;

    const data = activeNode.data || {};

    const handleDataChange = (key, value) => {
        updateNodeData(selectedNodeId, { [key]: value });
    };

    return (
        <div className="w-80 bg-white border-l border-slate-200 shadow-sm flex flex-col shrink-0 overflow-y-auto">

            {/* Sidebar Header */}
            <div className="h-16 border-b border-slate-100 flex items-center px-4 shrink-0">
                <button
                    onClick={() => setSelectedNodeId(null)}
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-600 font-medium text-sm transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    back
                </button>
            </div>

            {/* Node Title Header */}
            <div className="px-6 py-6 border-b border-slate-100 flex items-start gap-4">
                {activeNode.type === 'conditionNode' ? (
                    <div className="w-10 h-10 rounded-md bg-indigo-500 flex items-center justify-center text-white shrink-0 mt-1">
                        <Share2 className="w-5 h-5" />
                    </div>
                ) : (
                    <div className="w-10 h-10 rounded-md bg-teal-500 flex items-center justify-center text-white shrink-0 mt-1">
                        <Building2 className="w-5 h-5" />
                    </div>
                )}

                <div className="flex flex-col">
                    <span className="text-sm text-slate-500 font-medium">{data.label}</span>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        Untitled <span className="text-slate-300 text-sm">✎</span>
                    </h2>
                </div>
            </div>

            <div className="p-6 flex flex-col gap-6">

                {/* ---------- Integration Node Properties ---------- */}
                {activeNode.type === 'integrationNode' && (
                    <>
                        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-100">
                            <label className="text-xs font-bold text-slate-800 mb-1 block">Connection</label>
                            <p className="text-[11px] text-slate-500 mb-3">Select a credit bureau connection</p>

                            <div className="relative">
                                <select
                                    className="w-full appearance-none bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700 font-medium cursor-pointer shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    value={data.connection || ''}
                                    onChange={(e) => handleDataChange('connection', e.target.value)}
                                >
                                    <option value="Credit Bureau">Credit Bureau</option>
                                    <option value="Experian API">Experian API</option>
                                </select>
                                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>

                        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-100">
                            <label className="text-xs font-bold text-slate-800 mb-1 block">Field assignment</label>
                            <p className="text-[11px] text-slate-500 mb-3">Select or specify a field to assign the report</p>

                            <div className="flex border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm mb-4">
                                <div className="bg-[#E2E8F0] px-3 py-2 text-blue-700 text-xs font-semibold border-r border-slate-200 shrink-0 flex items-center">
                                    data.
                                </div>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 text-sm text-slate-800 outline-none"
                                    value={data.fieldAssignment?.replace('data.', '') || 'credit_report'}
                                    onChange={(e) => handleDataChange('fieldAssignment', `data.${e.target.value}`)}
                                />
                            </div>

                            <button
                                onClick={() => openMappingModal({ source: data.connection, targetRoot: data.fieldAssignment })}
                                className="w-full bg-[#254EDD] hover:bg-blue-800 text-white font-semibold text-sm py-2.5 rounded-full transition-colors shadow-sm"
                            >
                                Select fields
                            </button>
                        </div>
                    </>
                )}

                {/* ---------- Condition Node Properties ---------- */}
                {activeNode.type === 'conditionNode' && (
                    <>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-bold text-slate-800">Fields</label>
                                <button className="flex items-center gap-1 border border-slate-200 rounded-full px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                    <PlusCircle className="w-3 h-3" /> Add Field
                                </button>
                            </div>
                            <p className="text-[11px] text-slate-500 mb-3">Select or specify the fields the condition is modifying</p>

                            <div className="flex items-center gap-2">
                                <div className="flex-1 flex border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm">
                                    <div className="bg-[#E2E8F0] px-3 py-2 text-blue-700 text-xs font-semibold border-r border-slate-200 shrink-0 flex items-center">
                                        data.
                                    </div>
                                    <select
                                        className="w-full appearance-none px-3 py-2 text-sm text-slate-800 outline-none bg-transparent cursor-pointer"
                                        value={data.targetField?.replace('data.', '') || 'credit_decision'}
                                        onChange={(e) => handleDataChange('targetField', `data.${e.target.value}`)}
                                    >
                                        <option value="credit_decision">credit_decision</option>
                                        <option value="risk_tier">risk_tier</option>
                                    </select>
                                </div>
                                <button className="p-2 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-6">
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-xs font-bold text-slate-800">Rules</label>
                                <button className="flex items-center gap-1 border border-slate-200 rounded-full px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                                    <PlusCircle className="w-3 h-3" /> Add Rule
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-800 mb-3 block">Default values</label>

                            <div className="flex bg-[#F8FAFC] border border-emerald-100 rounded-md overflow-hidden p-1 shadow-sm items-center">
                                <div className="px-3 py-2 text-xs font-semibold text-slate-600 shrink-0">
                                    Default<br />value of
                                </div>
                                <div className="px-2 py-2 text-xs font-bold text-emerald-600 bg-white border border-slate-100 shrink-0">
                                    {data.targetField || 'data.credit_decision'}
                                </div>
                                <div className="px-2 text-slate-400 font-bold">=</div>
                                <input
                                    type="text"
                                    className="w-full bg-white border border-slate-200 rounded shadow-sm px-2 py-1.5 text-sm text-slate-800 outline-none"
                                    value={data.defaultValue || ''}
                                    placeholder="Enter default..."
                                    onChange={(e) => handleDataChange('defaultValue', e.target.value)}
                                />
                            </div>
                        </div>
                    </>
                )}

            </div>
        </div>
    );
}
