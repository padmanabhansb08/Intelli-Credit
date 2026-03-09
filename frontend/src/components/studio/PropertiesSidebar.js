"use client";

import React from 'react';
import useWorkflowStore from '@/store/useWorkflowStore';
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Play,
  Share2,
  Trash2,
  Waypoints,
} from 'lucide-react';

const NODE_META = {
  triggerNode: {
    icon: Play,
    tone: 'bg-emerald-500',
    label: 'Trigger',
  },
  integrationNode: {
    icon: Building2,
    tone: 'bg-blue-500',
    label: 'Integration',
  },
  conditionNode: {
    icon: Share2,
    tone: 'bg-rose-500',
    label: 'Condition',
  },
  documentClassificationNode: {
    icon: Waypoints,
    tone: 'bg-violet-500',
    label: 'Document Parser',
  },
  explainableAINode: {
    icon: Share2,
    tone: 'bg-amber-500',
    label: 'Explainability',
  },
};

export default function PropertiesSidebar() {
  const {
    nodes,
    selectedNodeId,
    updateNodeData,
    openMappingModal,
    workflowInitialInput,
    setSelectedNodeId,
    deleteNodeById,
  } = useWorkflowStore();

  if (!selectedNodeId) {
    return null;
  }

  const activeNode = nodes.find((node) => node.id === selectedNodeId);
  if (!activeNode) {
    return null;
  }

  const data = activeNode.data || {};
  const executionConfig = data.executionConfig || {};
  const meta = NODE_META[activeNode.type] || NODE_META.integrationNode;
  const NodeIcon = meta.icon;

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

  const handleDelete = () => {
    deleteNodeById(selectedNodeId);
  };

  return (
    <aside className="w-[360px] bg-white border-l border-slate-200 shadow-sm flex flex-col shrink-0 overflow-y-auto">
      <div className="h-16 border-b border-slate-100 flex items-center justify-between px-4 shrink-0">
        <button
          onClick={() => setSelectedNodeId(null)}
          className="flex items-center gap-1 text-slate-400 hover:text-slate-600 font-medium text-sm transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Close
        </button>
        <button
          onClick={handleDelete}
          className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete node
        </button>
      </div>

      <div className="px-6 py-6 border-b border-slate-100 flex items-start gap-4">
        <div className={`w-11 h-11 rounded-2xl ${meta.tone} flex items-center justify-center text-white shrink-0 mt-1`}>
          <NodeIcon className="w-5 h-5" />
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-[0.18em] truncate">{meta.label}</span>
          <h2 className="text-xl font-bold text-slate-800 truncate mt-1">{data.label || activeNode.id}</h2>
          <span className="text-xs text-slate-400 font-mono mt-2">{activeNode.id}</span>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-6">
        <div className="bg-[#F8FAFC] p-4 rounded-3xl border border-slate-100">
          <label className="text-xs font-bold text-slate-800 mb-2 block">Node label</label>
          <input
            type="text"
            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={data.label || ''}
            onChange={(event) => handleDataChange('label', event.target.value)}
            placeholder="Enter node label"
          />
        </div>

        {activeNode.type === 'triggerNode' && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-4">
            <label className="text-xs font-bold text-emerald-900 mb-2 block">Attached trigger payload</label>
            <p className="text-sm text-emerald-800">
              {workflowInitialInput?.documents?.length
                ? `${workflowInitialInput.documents.length} uploaded document payload${workflowInitialInput.documents.length > 1 ? 's are' : ' is'} ready for this workflow run.`
                : 'No uploaded Databricks payload is attached yet. The trigger will use the default manual input.'}
            </p>
            {workflowInitialInput?.applicant_name && (
              <p className="text-xs text-emerald-700 mt-3 font-medium">
                Applicant: {workflowInitialInput.applicant_name}
              </p>
            )}
          </div>
        )}

        {activeNode.type === 'documentClassificationNode' && (
          <div className="bg-[#F8FAFC] p-4 rounded-3xl border border-slate-100 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-800 mb-2 block">Confidence score</label>
              <input
                type="number"
                min="0"
                max="100"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                value={data.confidence ?? ''}
                onChange={(event) => handleDataChange('confidence', Number(event.target.value))}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-800 mb-2 block">Extracted fields JSON</label>
              <textarea
                className="w-full min-h-40 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 font-mono"
                value={JSON.stringify(data.extractedFields || [], null, 2)}
                onChange={(event) => {
                  try {
                    handleDataChange('extractedFields', JSON.parse(event.target.value || '[]'));
                  } catch {
                    // Ignore invalid JSON until it parses.
                  }
                }}
                spellCheck={false}
              />
            </div>
          </div>
        )}

        {activeNode.type === 'integrationNode' && (
          <>
            <div className="bg-[#F8FAFC] p-4 rounded-3xl border border-slate-100">
              <label className="text-xs font-bold text-slate-800 mb-1 block">Connection</label>
              <p className="text-[11px] text-slate-500 mb-3">Select the downstream integration this node should call.</p>
              <div className="relative">
                <select
                  className="w-full appearance-none bg-white border border-slate-200 rounded-2xl px-3 py-2.5 text-sm text-slate-700 font-medium cursor-pointer shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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

            <div className="bg-[#F8FAFC] p-4 rounded-3xl border border-slate-100">
              <label className="text-xs font-bold text-slate-800 mb-1 block">Credential reference</label>
              <p className="text-[11px] text-slate-500 mb-3">Reference a vault entry by ID. Secrets stay out of execution logs.</p>
              <input
                type="text"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={data.credentialId || ''}
                onChange={(event) => handleDataChange('credentialId', event.target.value)}
                placeholder="cred_eqx_prod"
              />
            </div>

            <div className="bg-[#F8FAFC] p-4 rounded-3xl border border-slate-100">
              <label className="text-xs font-bold text-slate-800 mb-1 block">Request body template</label>
              <p className="text-[11px] text-slate-500 mb-3">Expressions like {'{{ nodes.doc_1.fields.GrossMargin }}'} resolve at runtime.</p>
              <textarea
                className="w-full min-h-32 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                value={data.requestBody || ''}
                onChange={(event) => handleDataChange('requestBody', event.target.value)}
                spellCheck={false}
              />
            </div>

            <div className="bg-[#F8FAFC] p-4 rounded-3xl border border-slate-100">
              <label className="text-xs font-bold text-slate-800 mb-1 block">Field assignment</label>
              <p className="text-[11px] text-slate-500 mb-3">Choose where mapped response fields land in this node output.</p>

              <div className="flex border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm mb-4">
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
                onClick={() => openMappingModal({
                  nodeId: selectedNodeId,
                  source: data.connection,
                  targetRoot: data.fieldAssignment || 'data.credit_report',
                  existingMapping: data.outputMapping,
                  fieldMappings: data.fieldMappings,
                  rawData: data.mockResponse || workflowInitialInput?.extracted || {},
                })}
                className="w-full bg-[#254EDD] hover:bg-blue-800 text-white font-semibold text-sm py-3 rounded-full transition-colors shadow-sm"
              >
                Open field mapper
              </button>
            </div>
          </>
        )}

        {activeNode.type === 'conditionNode' && (
          <>
            <div className="bg-[#F8FAFC] p-4 rounded-3xl border border-slate-100">
              <label className="text-xs font-bold text-slate-800 mb-1 block">Condition expression</label>
              <p className="text-[11px] text-slate-500 mb-3">Use expressions to decide the active true or false branch.</p>
              <textarea
                className="w-full min-h-28 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-mono"
                value={data.expression || data.assignmentDetails || ''}
                onChange={(event) => {
                  handleDataChange('expression', event.target.value);
                  handleDataChange('assignmentDetails', event.target.value);
                }}
                spellCheck={false}
              />
            </div>

            <div className="bg-[#F8FAFC] p-4 rounded-3xl border border-slate-100">
              <label className="text-xs font-bold text-slate-800 mb-2 block">Target field</label>
              <div className="flex border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                <div className="bg-[#E2E8F0] px-3 py-2 text-blue-700 text-xs font-semibold border-r border-slate-200 shrink-0 flex items-center">
                  data.
                </div>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm text-slate-800 outline-none"
                  value={data.targetField?.replace('data.', '') || 'credit_decision'}
                  onChange={(event) => handleDataChange('targetField', `data.${event.target.value}`)}
                  placeholder="credit_decision"
                />
              </div>
            </div>

            <div className="bg-[#F8FAFC] p-4 rounded-3xl border border-slate-100">
              <label className="text-xs font-bold text-slate-800 mb-2 block">Default value</label>
              <input
                type="text"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                value={data.defaultValue || ''}
                onChange={(event) => handleDataChange('defaultValue', event.target.value)}
                placeholder="REVIEW"
              />
            </div>
          </>
        )}

        <div className="border-t border-slate-100 pt-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock3 className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800">Execution policy</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F8FAFC] p-3 rounded-2xl border border-slate-100">
              <label className="text-[11px] font-bold text-slate-800 block mb-2">Retries</label>
              <input
                type="number"
                min="0"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                value={executionConfig.maxRetries ?? 0}
                onChange={(event) => handleExecutionConfigChange('maxRetries', Number(event.target.value))}
              />
            </div>
            <div className="bg-[#F8FAFC] p-3 rounded-2xl border border-slate-100">
              <label className="text-[11px] font-bold text-slate-800 block mb-2">Retry delay (ms)</label>
              <input
                type="number"
                min="0"
                step="100"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                value={executionConfig.retryDelay ?? 0}
                onChange={(event) => handleExecutionConfigChange('retryDelay', Number(event.target.value))}
              />
            </div>
          </div>

          <div className="mt-3 bg-[#F8FAFC] p-4 rounded-3xl border border-slate-100">
            <label className="text-[11px] font-bold text-slate-800 block mb-2">Continue on fail</label>
            <label className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-3 py-3 text-sm text-slate-700">
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
    </aside>
  );
}
