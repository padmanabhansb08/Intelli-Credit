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
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  MCAFilingSyncNode,
  EPFOAnomalyNode,
} from '@/components/studio/nodes';
import {
  buildStudioWebSocketUrl,
  estimateWorkflowCost,
  startWorkflowExecution,
} from '@/lib/api';
import useWorkflowStore from '@/store/useWorkflowStore';

const nodeTypes = {
  triggerNode: TriggerNode,
  integrationNode: IntegrationNode,
  conditionNode: ConditionNode,
  documentClassificationNode: DocumentClassificationNode,
  explainableAINode: ExplainableAINode,
  mcaFilingSyncNode: MCAFilingSyncNode,
  epfoAnomalyNode: EPFOAnomalyNode,
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
          payloadTemplate: '{}'
        },
      };
    case 'documentClassificationNode':
      return {
        ...baseNode,
        data: {
          label: 'Databricks Document Parse',
          confidence: 96,
          model: 'llama3-70b-8192',
          promptTemplate: 'Extract entities from document.',
          confidenceThreshold: 85.0,
          extractedFields: [
            { key: 'Applicant', value: 'Sample Applicant' },
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
          modelReference: 'credit_lgbm_v2',
          topK: 5,
          baselineDataset: 'q3_approved_loans',
          shapValues: [
            { name: 'Debt-to-Income', impact: 1.84 },
            { name: 'Years in Business', impact: -0.65 },
            { name: 'Revolving Util', impact: 0.92 },
          ],
        },
      };
    case 'mcaFilingSyncNode':
      return {
        ...baseNode,
        data: {
          label: 'MCA V3 Gateway',
          cinTarget: 'L59100MH1983PLC029321',
          syncDirectors: true,
          syncFinancials: true,
        },
      };
    case 'epfoAnomalyNode':
      return {
        ...baseNode,
        data: {
          label: 'EPFO Anomalies',
          employerIdTarget: 'MH/BAN/0000000/000',
          toleranceMonths: 3,
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
  const [toastMessage, setToastMessage] = useState(null);
  const socketRef = useRef(null);
  const deferredLogs = useDeferredValue(executionLogs);

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
        // Calculate a dummy frontend cost based on node types
        let cost = 0;
        nodes.forEach(n => {
          if (n.type === 'documentClassificationNode') cost += 0.5;
          if (n.type === 'explainableAINode') cost += 1.2;
          if (n.type === 'integrationNode') cost += 0.3;
        });

        setCostEstimate({
          total_credits: cost.toFixed(2),
          currency_equivalent: (cost * 0.05).toFixed(2)
        });
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
    // Stubbed Websocket Connection for Frontend Preview
    setWebSocketStatus('connecting');

    setTimeout(() => {
      setWebSocketStatus('connected');

      // Mock node evaluation loop for UI
      setTimeout(() => handleExecutionEvent({ type: 'execution.started', execution_id: 'local_run_01' }), 200);

      let delay = 1000;
      nodes.forEach((node, index) => {
        setTimeout(() => handleExecutionEvent({ type: 'node.started', node_id: node.id }), delay);
        setTimeout(() => handleExecutionEvent({ type: 'node.completed', node_id: node.id }), delay + 800);
        delay += 1200;
      });

      setTimeout(() => {
        handleExecutionEvent({ type: 'execution.completed', execution_id: 'local_run_01' });
        setWebSocketStatus('disconnected');
      }, delay + 500);

    }, 500);
  }, [handleExecutionEvent, setWebSocketStatus, nodes]);

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

      beginExecution({ executionId: response.policy_id || workflowId });
      setIsTracePanelOpen(true);

      // For ephemeral draft execution, we simulate the execution flow
      if (response.status === 'success') {
        openExecutionSocket(`/ws/execution/${response.policy_id}`);
      }
    } catch (error) {
      console.error('Failed to start workflow execution', error);

      let errorTitle = 'Execution Failed';
      let errorMessage = error.message;

      // Check for specific error types
      if (error.message.includes('Cycle detected') || error.message.includes('cycle')) {
        errorTitle = 'Invalid Workflow Graph';
        errorMessage = 'Circular dependency detected. Please review your node connections and remove any loops.';
      } else if (error.message.includes('not found')) {
        errorTitle = 'Workflow Not Found';
        errorMessage = 'The workflow could not be found. Please ensure you have a valid workflow configured.';
      }

      setWebSocketStatus('error');

      // Show error in execution panel
      applyExecutionEvent({
        type: 'execution.error',
        level: 'ERROR',
        message: `${errorTitle}: ${errorMessage}`,
        timestamp: new Date().toISOString()
      });

      // Show toast notification
      setToastMessage(`${errorTitle}: ${errorMessage}`);
      setTimeout(() => setToastMessage(null), 5000);
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

      {/* Dynamic Error Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-[200] max-w-md bg-rose-500/95 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 backdrop-blur-md border border-rose-400/30 font-sans"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-100" />
            <span className="text-sm font-medium leading-relaxed drop-shadow-sm">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
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
      className="bg-[#0d0d12] dark"
      defaultEdgeOptions={{
        type: 'smoothstep',
      }}
    >
      <Background color="#1e1e2e" gap={20} size={1} />
      <Controls className="!bg-[#1a1a24] !border-white/10 !shadow-lg [&>button]:!bg-[#1a1a24] [&>button]:!border-white/10 [&>button]:!text-white [&>button:hover]:!bg-white/10" />
    </ReactFlow>
  );
}
