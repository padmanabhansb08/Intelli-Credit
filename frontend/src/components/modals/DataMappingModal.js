"use client";

import React, { useState } from 'react';
import useWorkflowStore from '@/store/useWorkflowStore';
import { X, ChevronRight, ChevronDown, Trash2 } from 'lucide-react';

const STATIC_RAW_DATA = {
    rspReport: {
        enquiryType: "NA",
        reportDate: "11/05/2026",
        enquiryNumber: "288226837",
        productType: "BNPL",
        numberOfApplicants: "1",
        accountType: "S",
        enquiryReference: "ONR202603171758140D1F89",
        amount: "266.00",
        typeOfMember: "FULL",
        statusOfMember: "ACTIV",
        processingDepartment: "",
        enquiryReason: "",
        consumer: {},
        score: {
            scoreForEnquiry: "420",
            scoreCard: "6",
            scoreIndex: "1",
            scoreMinimum: "300",
            scoreMaximum: "850"
        }
    }
};

export default function DataMappingModal() {
    const { closeMappingModal, mappingConfig } = useWorkflowStore();

    // Manage selected mappings mapped over to column 2
    const [selectedFields, setSelectedFields] = useState([
        { path: 'rspReport > score > scoreForEnquiry', keyName: 'score_value' }
    ]);

    // Expanded paths in JSON tree
    const [expandedPaths, setExpandedPaths] = useState(new Set(['root', 'root.rspReport', 'root.rspReport.score']));

    const togglePath = (path) => {
        const next = new Set(expandedPaths);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        setExpandedPaths(next);
    };

    const addFieldSelection = (fullPathArray, value) => {
        const pathStr = fullPathArray.join(' > ');
        const defaultKeyName = fullPathArray[fullPathArray.length - 1];

        // Prevent dupes
        if (selectedFields.some(f => f.path === pathStr)) return;

        setSelectedFields(prev => [...prev, { path: pathStr, keyName: defaultKeyName, sampleValue: value }]);
    };

    const removeField = (index) => {
        setSelectedFields(prev => prev.filter((_, i) => i !== index));
    };

    const updateFieldKey = (index, newKeyName) => {
        setSelectedFields(prev => prev.map((f, i) => i === index ? { ...f, keyName: newKeyName } : f));
    };

    // Recursive component to render Collapsible JSON Tree
    const JsonTreeViewer = ({ data, parentKey = 'root', pathArray = [] }) => {
        if (typeof data !== 'object' || data === null) {
            return (
                <div
                    className="ml-6 flex items-center gap-2 py-0.5 group cursor-pointer"
                    onClick={() => addFieldSelection(pathArray, data)}
                >
                    <span className="bg-[#254EDD] text-white px-1.5 py-0.5 rounded text-[10px] font-mono group-hover:bg-blue-600 transition-colors">
                        {pathArray[pathArray.length - 1]}
                    </span>
                    <span className="text-[11px] text-emerald-500 font-mono truncate">"{data}"</span>
                </div>
            );
        }

        const isExpanded = expandedPaths.has(parentKey);
        const keys = Object.keys(data);

        if (keys.length === 0) {
            return (
                <div className="ml-6 flex items-center gap-2 py-0.5">
                    <span className="bg-[#254EDD] text-white px-1.5 py-0.5 rounded text-[10px] font-mono opacity-60">
                        {pathArray[pathArray.length - 1] || '{ } object'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">{`{ }`}</span>
                </div>
            );
        }

        return (
            <div className={`${parentKey !== 'root' ? 'ml-6' : ''}`}>
                <div
                    className="flex items-center gap-1 py-0.5 cursor-pointer hover:bg-slate-100 rounded-md"
                    onClick={() => togglePath(parentKey)}
                >
                    {isExpanded ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
                    {parentKey !== 'root' ? (
                        <span className="bg-[#254EDD] text-white px-1.5 py-0.5 rounded text-[10px] font-mono">
                            {pathArray[pathArray.length - 1]}
                        </span>
                    ) : (
                        <span className="text-slate-500 text-xs font-mono">{`{ } object`}</span>
                    )}
                    {parentKey !== 'root' && <span className="text-slate-400 text-xs font-mono">{`{ } object`}</span>}
                </div>

                {isExpanded && (
                    <div className="border-l border-slate-200 ml-1.5 mt-0.5 mb-1">
                        {keys.map(key => (
                            <JsonTreeViewer
                                key={key}
                                data={data[key]}
                                parentKey={`${parentKey}.${key}`}
                                pathArray={[...pathArray, key]}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Calculate Column 3 Output Payload
    const outputPayload = selectedFields.reduce((acc, field) => {
        acc[field.keyName] = field.sampleValue || "sample_value";
        return acc;
    }, {});


    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-8">
            <div className="bg-white w-full max-w-6xl h-[85vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Modal Header */}
                <div className="h-20 border-b border-slate-200 flex items-center justify-between px-8 bg-slate-50 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Please select the fields you are interested in</h2>
                        <p className="text-sm text-slate-500 font-medium">Click on the fields to select them and optionally change the field names and hierarchy.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={closeMappingModal}
                            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <button
                            onClick={closeMappingModal}
                            className="bg-[#111827] hover:bg-black text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-sm transition-colors"
                        >
                            Save changes
                        </button>
                    </div>
                </div>

                {/* 3-Column Layout */}
                <div className="flex-1 flex overflow-hidden">

                    {/* Column 1: Raw Data */}
                    <div className="flex-1 border-r border-slate-200 flex flex-col bg-[#F8FAFC]">
                        <div className="h-10 bg-slate-200/50 border-b border-slate-200 flex items-center px-4 shrink-0">
                            <span className="text-xs font-bold text-slate-700">1. Raw data</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 select-none">
                            <JsonTreeViewer data={STATIC_RAW_DATA} />
                        </div>
                    </div>

                    {/* Column 2: Selected Fields */}
                    <div className="flex-1 border-r border-slate-200 flex flex-col bg-[#F8FAFC]">
                        <div className="h-10 bg-slate-200/50 border-b border-slate-200 flex items-center px-4 shrink-0">
                            <span className="text-xs font-bold text-slate-700">2. Selected fields</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                            {selectedFields.length === 0 && (
                                <div className="text-center text-slate-400 text-sm mt-10 italic">
                                    Click fields in the raw data tree to map them.
                                </div>
                            )}

                            {selectedFields.map((field, index) => (
                                <div key={index} className="bg-[#254EDD] rounded-lg p-3 shadow-md border border-blue-600 group">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] text-blue-200 font-mono tracking-wide">{field.path}</span>
                                        <button
                                            onClick={() => removeField(index)}
                                            className="text-blue-300 hover:text-white p-1 rounded transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full bg-white text-slate-800 text-sm font-bold px-3 py-2 rounded shadow-inner outline-none focus:ring-2 focus:ring-blue-400/50"
                                        value={field.keyName}
                                        onChange={(e) => updateFieldKey(index, e.target.value)}
                                        placeholder="Enter key name..."
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Column 3: Output Preview */}
                    <div className="flex-1 flex flex-col bg-[#F8FAFC]">
                        <div className="h-10 bg-slate-200/50 border-b border-slate-200 flex items-center px-4 shrink-0">
                            <span className="text-xs font-bold text-slate-700">3. Output</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm font-mono text-sm leading-relaxed">
                                <div className="text-slate-400 mb-2">{`{   // mapped output preview`}</div>
                                {selectedFields.map((field, i) => (
                                    <div key={i} className="ml-4 flex items-center gap-2 mb-1.5 cursor-default">
                                        <span className="bg-[#254EDD] text-white px-2 py-0.5 rounded textxs">{field.keyName}</span>
                                        <span className="text-emerald-600">{`"${field.sampleValue || 'sample_value'}"`}</span>
                                        {i < selectedFields.length - 1 && <span className="text-slate-400">,</span>}
                                    </div>
                                ))}
                                <div className="text-slate-400 mt-2">{`}`}</div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
