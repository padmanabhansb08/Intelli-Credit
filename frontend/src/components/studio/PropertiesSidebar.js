"use client";

import React from 'react';
import useWorkflowStore from '@/store/useWorkflowStore';
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  Clock3,
  PlusCircle,
  Share2,
  Trash2,
} from 'lucide-react';

export default function PropertiesSidebar() {
  const { nodes, selectedNodeId, updateNodeData, openMappingModal, setSelectedNodeId } = useWorkflowStore();

  if (!selectedNodeId) return null;

  const activeNode = nodes.find((node) => node.id === selectedNodeId);
  if (!activeNode) return null;

  const data = activeNode.data || {};
  const executionConfig = data.executionConfig || {};

  const handleDataChange = (key, value) => {
    updateNodeData(selectedNodeId, { [key]: value });
  };

  const handleExecutionConfigChange = (key, value) => {
    updateNodeData(selectedNodeId, {
      executionConfig: {
        ...executionConfig,
        [key]: value,
      },
    });
  };

  return (
    <div className="w-80 bg-white border-l border-slate-200 shadow-sm flex flex-col shrink-0 overflow-y-auto">
      <div className="h-16 border-b border-slate-100 flex items-center px-4 shrink-0">
        <button
          onClick={() => setSelectedNodeId(null)}
          className="flex items-center gap-1 text-slate-400 hover:text-slate-600 font-medium text-sm transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          back
        </button>
      </div>

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

        <div className="flex flex-col min-w-0">
          <span className="text-sm text-slate-500 font-medium truncate">{data.label}</span>
          <h2 className="text-xl font-bold text-slate-800 truncate">{activeNode.id}</h2>
          <span className="text-xs text-slate-400 uppercase tracking-wide mt-1">{activeNode.type}</span>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-6">
        {activeNode.type === 'integrationNode' && (
          <>
            <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-100">
              <label className="text-xs font-bold text-slate-800 mb-1 block">Connection</label>
              <p className="text-[11px] text-slate-500 mb-3">Select the downstream integration the node should call.</p>

              <div className="relative">
                <select
                  className="w-full appearance-none bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-700 font-medium cursor-pointer shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  value={data.connection || ''}
                  onChange={(event) => handleDataChange('connection', event.target.value)}
                >
                  <option value="Credit Bureau">Credit Bureau</option>
                  <option value="Risk API Gateway">Risk API Gateway</option>
                  <option value="Experian API">Experian API</option>
                  <option value="Core Banking">Core Banking</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-100">
              <label className="text-xs font-bold text-slate-800 mb-1 block">Credential reference</label>
              <p className="text-[11px] text-slate-500 mb-3">Reference a vault entry by ID. Secrets never appear in execution logs.</p>
              <input
                type="text"
                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={data.credentialId || ''}
                onChange={(event) => handleDataChange('credentialId', event.target.value)}
                placeholder="cred_eqx_prod"
              />
            </div>

            <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-100">
              <label className="text-xs font-bold text-slate-800 mb-1 block">Request body template</label>
              <p className="text-[11px] text-slate-500 mb-3">Expressions like {'{{ nodes.doc_1.fields.Corporation }}'} resolve at runtime.</p>
              <textarea
                className="w-full min-h-32 bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                value={data.requestBody || ''}
                onChange={(event) => handleDataChange('requestBody', event.target.value)}
                spellCheck={false}
              />
            </div>

            <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-100">
              <label className="text-xs font-bold text-slate-800 mb-1 block">Field assignment</label>
              <p className="text-[11px] text-slate-500 mb-3">Optional mapper entrypoint for downstream payload shaping.</p>

              <div className="flex border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm mb-4">
                <div className="bg-[#E2E8F0] px-3 py-2 text-blue-700 text-xs font-semibold border-r border-slate-200 shrink-0 flex items-center">
                  data.
                </div>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm text-slate-800 outline-none"
                  value={data.fieldAssignment?.replace('data.', '') || 'credit_report'}
                  onChange={(event) => handleDataChange('fieldAssignment', `data.${event.target.value}`)}
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

        {activeNode.type === 'conditionNode' && (
          <>
            <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-100">
              <label className="text-xs font-bold text-slate-800 mb-1 block">Condition expression</label>
              <p className="text-[11px] text-slate-500 mb-3">Use runtime expressions to choose the true or false edge.</p>
              <textarea
                className="w-full min-h-24 bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                value={data.expression || data.assignmentDetails || ''}
                onChange={(event) => {
                  handleDataChange('expression', event.target.value);
                  handleDataChange('assignmentDetails', event.target.value);
                }}
                spellCheck={false}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-800">Fields</label>
                <button className="flex items-center gap-1 border border-slate-200 rounded-full px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  <PlusCircle className="w-3 h-3" /> Add Field
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">Select or specify the field this decision node writes to.</p>

              <div className="flex items-center gap-2">
                <div className="flex-1 flex border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm">
                  <div className="bg-[#E2E8F0] px-3 py-2 text-blue-700 text-xs font-semibold border-r border-slate-200 shrink-0 flex items-center">
                    data.
                  </div>
                  <select
                    className="w-full appearance-none px-3 py-2 text-sm text-slate-800 outline-none bg-transparent cursor-pointer"
                    value={data.targetField?.replace('data.', '') || 'credit_decision'}
                    onChange={(event) => handleDataChange('targetField', `data.${event.target.value}`)}
                  >
                    <option value="credit_decision">credit_decision</option>
                    <option value="risk_tier">risk_tier</option>
                    <option value="routing_bucket">routing_bucket</option>
                  </select>
                </div>
                <button className="p-2 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 mb-3 block">Default value</label>
              <div className="flex bg-[#F8FAFC] border border-emerald-100 rounded-md overflow-hidden p-1 shadow-sm items-center">
                <div className="px-3 py-2 text-xs font-semibold text-slate-600 shrink-0">
                  Default
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
                  onChange={(event) => handleDataChange('defaultValue', event.target.value)}
                />
              </div>
            </div>
          </>
        )}

        <div className="border-t border-slate-100 pt-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock3 className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800">Execution policy</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
              <label className="text-[11px] font-bold text-slate-800 block mb-2">Retries</label>
              <input
                type="number"
                min="0"
                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                value={executionConfig.maxRetries ?? 0}
                onChange={(event) => handleExecutionConfigChange('maxRetries', Number(event.target.value))}
              />
            </div>
            <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
              <label className="text-[11px] font-bold text-slate-800 block mb-2">Retry delay (ms)</label>
              <input
                type="number"
                min="0"
                step="100"
                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                value={executionConfig.retryDelay ?? 0}
                onChange={(event) => handleExecutionConfigChange('retryDelay', Number(event.target.value))}
              />
            </div>
          </div>

          <div className="mt-3 bg-[#F8FAFC] p-4 rounded-xl border border-slate-100">
            <label className="text-[11px] font-bold text-slate-800 block mb-2">Continue on fail</label>
            <label className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700">
              Route failure to the <span className="font-mono text-rose-500">error</span> handle
              <input
                type="checkbox"
                checked={Boolean(executionConfig.continueOnFail)}
                onChange={(event) => handleExecutionConfigChange('continueOnFail', event.target.checked)}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

