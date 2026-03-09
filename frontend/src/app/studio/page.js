"use client";

import React, {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from 'react';
import ReactFlow, { Background, Controls, ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Coins,
  DatabaseZap,
  Play,
  Trash2,
  Workflow,
  X,
} from 'lucide-react';
import NextLink from 'next/link';
import DataMappingModal from '@/components/modals/DataMappingModal';
import ExecutionPanel from '@/components/studio/ExecutionPanel';
import NodeLibrary from '@/components/studio/NodeLibrary';
import PropertiesSidebar from '@/components/studio/PropertiesSidebar';
import {
  ConditionNode,
  DocumentClassificationNode,
  ExplainableAINode,
  IntegrationNode,
  TriggerNode,
} from '@/components/studio/nodes';
import {
  buildStudioWebSocketUrl,
  estimateWorkflowCost,
  startWorkflowExecution,
} from '@/lib/api';
import useWorkflowStore from '@/store/useWorkflowStore';
import useAppStore from '@/store/useAppStore';

const nodeTypes = {
  triggerNode: TriggerNode,
  integrationNode: IntegrationNode,
  conditionNode: ConditionNode,
  documentClassificationNode: DocumentClassificationNode,
  explainableAINode: ExplainableAINode,
};

const createNodeId = (type) => `${type}-${(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 11)).slice(0, 8)}`;

const buildNodeBlueprint = (type, position) => {
  const baseNode = {
    id: createNodeId(type),
    type,
    position,
    data: {
      label: 'New Node',
    },
  };

  switch (type) {
    case 'triggerNode':
      return {
        ...baseNode,
        data: {
          label: 'Inbound Proposal Trigger',
          triggerType: 'manual',
        },
      };
    case 'documentClassificationNode':
      return {
        ...baseNode,
        data: {
          label: 'Databricks Document Parse',
          confidence: 96,
          extractedFields: [
            { key: 'Applicant', value: 'ACME Corp' },
            { key: 'RequestedLimit', value: '250000' },
          ],
        },
      };
    case 'integrationNode':
      return {
        ...baseNode,
        data: {
          label: 'Integration API',
          connection: 'Risk API Gateway',
          fieldAssignment: 'data.credit_report',
          requestBody: '{\n  "company": "{{ input.applicant_name }}",\n  "requestedAmount": "{{ input.requested_amount }}"\n}',
          mockResponse: {
            riskScore: 742,
            approvedLimit: 300000,
          },
          outputMapping: {
            credit_report: {
              riskScore: '{{ response.riskScore }}',
              approvedLimit: '{{ response.approvedLimit }}',
            },
          },
          fieldMappings: [
            {
              path: 'riskScore',
              sourceSegments: ['riskScore'],
              keyName: 'credit_report.riskScore',
              sampleValue: '742',
            },
            {
              path: 'approvedLimit',
              sourceSegments: ['approvedLimit'],
              keyName: 'credit_report.approvedLimit',
              sampleValue: '300000',
            },
          ],
        },
      };
    case 'conditionNode':
      return {
        ...baseNode,
        data: {
          label: 'Risk Score Check',
          expression: '{{ nodes.integrationNode.credit_report.riskScore }} > 700',
          assignmentDetails: '{{ nodes.integrationNode.credit_report.riskScore }} > 700',
          targetField: 'data.credit_decision',
          defaultValue: 'REVIEW',
        },
      };
    case 'explainableAINode':
      return {
        ...baseNode,
        data: {
          label: 'TreeSHAP Attributions',
          shapValues: [
            { name: 'Debt-to-Income', impact: 1.84 },
            { name: 'Years in Business', impact: -0.65 },
            { name: 'Revolving Util', impact: 0.92 },
          ],
        },
      };
    default:
      return baseNode;
  }
};

const isEditableTarget = (target) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
};

export default function DecisionStudio() {
  const {
    applyExecutionEvent,
    beginExecution,
    clearWorkflowInitialInput,
    currentExecutionId,
    edges,
    executionLogs,
    executionStatus,
    hydrateWorkflowInitialInput,
    isMappingModalOpen,
    nodes,
    resetExecutionState,
    selectedEdgeId,
    selectedNodeId,
    setWebSocketStatus,
    websocketStatus,
    workflowInitialInput,
  } = useWorkflowStore();
  const [isDeploying, setIsDeploying] = useState(false);
  const [costEstimate, setCostEstimate] = useState(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isTracePanelOpen, setIsTracePanelOpen] = useState(true);
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(false);
  const socketRef = useRef(null);
  const deferredLogs = useDeferredValue(executionLogs);
  const addWorkflowProposal = useAppStore(s => s.addWorkflowProposal);

  const handleExecutionEvent = useCallback((event) => {
    startTransition(() => {
      applyExecutionEvent(event);
    });
  }, [applyExecutionEvent]);

  useEffect(() => {
    hydrateWorkflowInitialInput();
  }, [hydrateWorkflowInitialInput]);

  useEffect(() => () => {
    socketRef.current?.close();
  }, []);

  useEffect(() => {
    const estimate = async () => {
      if (nodes.length === 0) {
        setCostEstimate(null);
        return;
      }

      setIsEstimating(true);
      try {
        const data = await estimateWorkflowCost({ nodes, edges, workflow_id: 'studio_preview' });
        setCostEstimate(data);
      } catch (error) {
        console.error('Failed to estimate workflow cost', error);
      } finally {
        setIsEstimating(false);
      }
    };

    const timer = setTimeout(estimate, 350);
    return () => clearTimeout(timer);
  }, [nodes, edges]);

  const openExecutionSocket = useCallback((websocketPath) => {
    socketRef.current?.close();
    const socket = new WebSocket(buildStudioWebSocketUrl(websocketPath));
    socketRef.current = socket;
    setWebSocketStatus('connecting');

    socket.onopen = () => {
      setWebSocketStatus('connected');
    };

    socket.onmessage = (message) => {
      const parsed = JSON.parse(message.data);
      handleExecutionEvent(parsed);
    };

    socket.onerror = () => {
      setWebSocketStatus('error');
    };

    socket.onclose = () => {
      setWebSocketStatus('disconnected');
    };
  }, [handleExecutionEvent, setWebSocketStatus]);

  const handleDeploy = async () => {
    if (!nodes.length) {
      return;
    }

    setIsDeploying(true);
    try {
      resetExecutionState();
      const workflowId = `draft_${Date.now()}`;
      const response = await startWorkflowExecution({
        nodes,
        edges,
        workflow_id: workflowId,
        workflow_name: 'Decision Studio Draft',
        initial_input: workflowInitialInput || {},
      });

      beginExecution({ executionId: response.execution_id });
      setIsTracePanelOpen(true);
      openExecutionSocket(response.websocket_path);

      // Notify the global store so Review Station picks it up
      addWorkflowProposal({
        applicant_name: workflowInitialInput?.applicant_name || 'Studio Submission',
        requested_amount: workflowInitialInput?.requested_amount || 'N/A',
        workflow_name: 'Decision Studio Draft',
      });
    } catch (error) {
      console.error('Failed to start workflow execution', error);
      setWebSocketStatus('error');
      window.alert('Failed to connect to the workflow engine.');
    } finally {
      setIsDeploying(false);
    }
  };

  const selectedElementLabel = selectedNodeId
    ? 'Delete selected node'
    : selectedEdgeId
      ? 'Delete selected edge'
      : null;

  const payloadSummary = workflowInitialInput?.documents?.length
    ? `${workflowInitialInput.documents.length} uploaded document payload${workflowInitialInput.documents.length > 1 ? 's' : ''}`
    : 'No uploaded trigger payload';

  return (
    <div className="fixed inset-0 z-[100] bg-[#F8FAFC] flex flex-col font-sans overflow-hidden">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <NextLink href="/" className="text-sm font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-2">
            Back to workspace
          </NextLink>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-2">
            <div className="flex items-center gap-1.5 text-slate-700">
              <Coins className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold">
                {isEstimating ? 'Estimating...' : costEstimate ? `${costEstimate.total_credits} AI Credits` : '0 AI Credits'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              {costEstimate ? `Est. Cost: $${costEstimate.currency_equivalent}` : 'Est. Cost: $0.00'} / run
            </span>
          </div>

          <button
            onClick={handleDeploy}
            disabled={isDeploying || isEstimating}
            className="bg-[#254EDD] hover:bg-blue-800 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Play className="w-4 h-4 fill-current" />
            {isDeploying ? 'Starting...' : 'Deploy workflow'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <NodeLibrary
          collapsed={isLibraryCollapsed}
          onToggle={() => setIsLibraryCollapsed((current) => !current)}
          onDragStart={(event, nodeType) => {
            event.dataTransfer.setData('application/reactflow', nodeType);
            event.dataTransfer.effectAllowed = 'move';
          }}
        />

        <div className="flex-1 relative overflow-hidden bg-[#F4F5F7]">
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-3 max-w-md">
            <div className="rounded-[24px] border border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Workflow State</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">Decision Studio Draft</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {currentExecutionId ? `Latest run ${currentExecutionId}` : 'Manual trigger mode'}
                  </p>
                </div>
                <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600">
                  {executionStatus}
                </span>
              </div>
            </div>

            <div className="rounded-[24px] border border-cyan-200 bg-cyan-50/90 px-4 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-cyan-900">
                    <DatabaseZap className="w-4 h-4" />
                    <p className="text-sm font-semibold">Trigger payload</p>
                  </div>
                  <p className="text-sm text-cyan-900 mt-1">{payloadSummary}</p>
                  {workflowInitialInput?.applicant_name && (
                    <p className="text-xs text-cyan-800 mt-2">Applicant: {workflowInitialInput.applicant_name}</p>
                  )}
                </div>
                {workflowInitialInput && (
                  <button
                    onClick={clearWorkflowInitialInput}
                    className="w-8 h-8 rounded-xl bg-white/80 text-cyan-800 hover:bg-white transition-colors flex items-center justify-center"
                    aria-label="Clear trigger payload"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {selectedElementLabel && (
            <StudioSelectionToolbar label={selectedElementLabel} />
          )}

          <ReactFlowProvider>
            <DnDFlowContainer buildNodeBlueprint={buildNodeBlueprint} />
          </ReactFlowProvider>
        </div>

        <PropertiesSidebar />
      </div>

      <ExecutionPanel
        isOpen={isTracePanelOpen}
        onToggle={() => setIsTracePanelOpen((current) => !current)}
        logs={deferredLogs}
        executionStatus={executionStatus}
        websocketStatus={websocketStatus}
        currentExecutionId={currentExecutionId}
      />

      {isMappingModalOpen && <DataMappingModal />}
    </div>
  );
}

function StudioSelectionToolbar({ label }) {
  const { deleteSelectedElements } = useWorkflowStore();

  return (
    <div className="absolute top-4 right-4 z-20">
      <button
        onClick={deleteSelectedElements}
        className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm hover:bg-rose-50 transition-colors"
      >
        <Trash2 className="w-4 h-4" /> {label}
      </button>
    </div>
  );
}

function DnDFlowContainer({ buildNodeBlueprint }) {
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const {
    addNode,
    deleteSelectedElements,
    edges,
    nodes,
    onConnect,
    onEdgesChange,
    onEdgesDelete,
    onNodesChange,
    onNodesDelete,
    selectedEdgeId,
    selectedNodeId,
    setSelectedEdgeId,
    setSelectedNodeId,
    syncSelection,
  } = useWorkflowStore();

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.key !== 'Backspace' && event.key !== 'Delete') || isEditableTarget(event.target)) {
        return;
      }

      if (!selectedNodeId && !selectedEdgeId) {
        return;
      }

      event.preventDefault();
      deleteSelectedElements();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelectedElements, selectedEdgeId, selectedNodeId]);

  const onNodeClick = useCallback((event, node) => {
    event.stopPropagation();
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  const onEdgeClick = useCallback((event, edge) => {
    event.stopPropagation();
    setSelectedEdgeId(edge.id);
  }, [setSelectedEdgeId]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, [setSelectedEdgeId, setSelectedNodeId]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    if (!reactFlowInstance) {
      return;
    }

    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) {
      return;
    }

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    addNode(buildNodeBlueprint(type, position));
  }, [addNode, buildNodeBlueprint, reactFlowInstance]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodesDelete={onNodesDelete}
      onEdgesDelete={onEdgesDelete}
      onSelectionChange={syncSelection}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      nodeTypes={nodeTypes}
      onPaneClick={onPaneClick}
      onInit={setReactFlowInstance}
      onDrop={onDrop}
      onDragOver={onDragOver}
      deleteKeyCode={null}
      fitView
      attributionPosition="bottom-left"
      className="bg-[#F8F9FB]"
      defaultEdgeOptions={{
        type: 'smoothstep',
      }}
    >
      <Background color="#d6d9df" gap={20} size={1} />
      <Controls className="!bg-white !border-slate-200 !shadow-sm" />
    </ReactFlow>
  );
}
