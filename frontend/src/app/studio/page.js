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
  FileCheck,
  LayoutGrid,
  Layers,
  Link,
  Lock,
  Network,
  Play,
  Share2,
} from 'lucide-react';
import NextLink from 'next/link';
import DataMappingModal from '@/components/modals/DataMappingModal';
import ExecutionPanel from '@/components/studio/ExecutionPanel';
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

const nodeTypes = {
  triggerNode: TriggerNode,
  integrationNode: IntegrationNode,
  conditionNode: ConditionNode,
  documentClassificationNode: DocumentClassificationNode,
  explainableAINode: ExplainableAINode,
};

export default function DecisionStudio() {
  const {
    applyExecutionEvent,
    beginExecution,
    currentExecutionId,
    edges,
    executionLogs,
    executionStatus,
    isMappingModalOpen,
    nodes,
    resetExecutionState,
    setWebSocketStatus,
    websocketStatus,
  } = useWorkflowStore();
  const [isDeploying, setIsDeploying] = useState(false);
  const [costEstimate, setCostEstimate] = useState(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isTracePanelOpen, setIsTracePanelOpen] = useState(true);
  const socketRef = useRef(null);
  const deferredLogs = useDeferredValue(executionLogs);

  const handleExecutionEvent = useCallback((event) => {
    startTransition(() => {
      applyExecutionEvent(event);
    });
  }, [applyExecutionEvent]);

  useEffect(() => {
    return () => {
      socketRef.current?.close();
    };
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

    const timer = setTimeout(estimate, 500);
    return () => clearTimeout(timer);
  }, [nodes, edges]);

  const openExecutionSocket = useCallback(
    (websocketPath) => {
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
    },
    [handleExecutionEvent, setWebSocketStatus],
  );

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
      });

      beginExecution({ executionId: response.execution_id });
      setIsTracePanelOpen(true);
      openExecutionSocket(response.websocket_path);
    } catch (error) {
      console.error('Failed to start workflow execution', error);
      setWebSocketStatus('error');
      window.alert('Failed to connect to the workflow engine.');
    } finally {
      setIsDeploying(false);
    }
  };

  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#F8FAFC] flex flex-col font-sans overflow-hidden">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <NextLink href="/" className="text-sm font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-2">
            Back to workspace
          </NextLink>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-4">
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
            className="bg-[#254EDD] hover:bg-blue-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
          >
            {isDeploying ? 'Starting...' : <><Play className="w-3.5 h-3.5 fill-current" /> Deploy workflow</>}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col p-1">
            <button className="p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 rounded-md"><Lock className="w-4 h-4" /></button>
            <button className="p-2 bg-blue-50 text-blue-600 rounded-md"><LayoutGrid className="w-4 h-4" /></button>
            <button className="p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 rounded-md"><Link className="w-4 h-4" /></button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 px-4 w-80 flex items-center justify-between mt-2">
            <div>
              <span className="text-sm font-semibold text-slate-700">Decision Studio Draft</span>
              <p className="text-[11px] text-slate-400 mt-1">{currentExecutionId ? `Latest run ${currentExecutionId}` : 'Manual trigger mode'}</p>
            </div>
            <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600">
              {executionStatus}
            </span>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 flex gap-2 items-center mt-2 w-max shadow-md z-50">
            <div
              className="p-2 hover:bg-slate-100 rounded-md cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-200 flex items-center justify-center bg-emerald-50 shadow-sm"
              onDragStart={(event) => onDragStart(event, 'triggerNode')}
              draggable
              title="Drag Start Node"
            >
              <Play className="w-5 h-5 text-emerald-600 fill-current" />
            </div>
            <div
              className="p-2 hover:bg-slate-100 rounded-md cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-200 flex items-center justify-center bg-purple-50 shadow-sm"
              onDragStart={(event) => onDragStart(event, 'documentClassificationNode')}
              draggable
              title="Drag AI Document Extraction Node"
            >
              <FileCheck className="w-5 h-5 text-purple-600" />
            </div>
            <div
              className="p-2 hover:bg-slate-100 rounded-md cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-200 flex items-center justify-center bg-teal-50 shadow-sm"
              onDragStart={(event) => onDragStart(event, 'integrationNode')}
              draggable
              title="Drag Integration Node"
            >
              <Layers className="w-5 h-5 text-teal-600" />
            </div>
            <div
              className="p-2 hover:bg-slate-100 rounded-md cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-200 flex items-center justify-center bg-indigo-50 shadow-sm"
              onDragStart={(event) => onDragStart(event, 'conditionNode')}
              draggable
              title="Drag Condition Node"
            >
              <Network className="w-5 h-5 text-indigo-600" />
            </div>
            <div
              className="p-2 hover:bg-slate-100 rounded-md cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-200 flex items-center justify-center bg-amber-50 shadow-sm"
              onDragStart={(event) => onDragStart(event, 'explainableAINode')}
              draggable
              title="Drag Explainable AI Node"
            >
              <Share2 className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="flex-1 bg-[#F4F5F7] h-full">
          <ReactFlowProvider>
            <DnDFlowContainer />
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

function DnDFlowContainer() {
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, setSelectedNodeId, addNode } = useWorkflowStore();

  const onNodeClick = useCallback((event, node) => {
    event.stopPropagation();
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    if (!reactFlowInstance) return;

    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    let newLabel = 'New Node';
    let extraData = {};

    if (type === 'triggerNode') {
      newLabel = 'Trigger Event';
    } else if (type === 'documentClassificationNode') {
      newLabel = 'Proposal Parser';
      extraData = {
        confidence: 96,
        extractedFields: [
          { key: 'Applicant', value: 'ACME Corp' },
          { key: 'Requested', value: '$250,000' },
        ],
      };
    } else if (type === 'explainableAINode') {
      newLabel = 'TreeSHAP Attributions';
      extraData = {
        shapValues: [
          { name: 'Debt-to-Income', impact: 1.84 },
          { name: 'Years in Business', impact: -0.65 },
          { name: 'Revolving Util', impact: 0.92 },
        ],
      };
    } else if (type === 'integrationNode') {
      newLabel = 'Integration API';
      extraData = {
        connection: 'Select Connection...',
        requestBody: '{\n  "score": "{{ nodes.doc_1.fields.GrossMargin }}"\n}',
      };
    } else if (type === 'conditionNode') {
      newLabel = 'Condition Rule';
      extraData = {
        expression: '{{ nodes.integrationNode.response.score }} > 700',
        assignmentDetails: '{{ nodes.integrationNode.response.score }} > 700',
        targetField: 'data.decision',
        defaultValue: '',
        rules: [],
      };
    }

    addNode({
      id: `${type}-${Math.random().toString(36).slice(2, 11)}`,
      type,
      position,
      data: {
        label: newLabel,
        ...extraData,
      },
    });
  }, [addNode, reactFlowInstance]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      onPaneClick={onPaneClick}
      onInit={setReactFlowInstance}
      onDrop={onDrop}
      onDragOver={onDragOver}
      fitView
      attributionPosition="bottom-left"
      className="bg-[#F8F9FB]"
    >
      <Background color="#d6d9df" gap={20} size={1} />
      <Controls className="!bg-white !border-slate-200 !shadow-sm" />
    </ReactFlow>
  );
}

