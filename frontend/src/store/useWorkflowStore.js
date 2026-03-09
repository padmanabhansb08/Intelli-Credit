import { create } from 'zustand';
import { addEdge, applyEdgeChanges, applyNodeChanges } from 'reactflow';
import {
  clearWorkflowInitialInput as clearWorkflowInitialInputStorage,
  deepMerge,
  persistWorkflowInitialInput,
  readWorkflowInitialInput,
} from '@/lib/ingestion';

const DEFAULT_EXECUTION_CONFIG = {
  maxRetries: 0,
  retryDelay: 0,
  backoffMultiplier: 2,
  continueOnFail: false,
};

const DEFAULT_RUNTIME = {
  status: 'idle',
  attempt: 0,
  message: null,
  error: null,
  startedAt: null,
  finishedAt: null,
  durationMs: null,
  input: null,
  output: null,
  activeHandles: [],
};

const buildRuntime = (runtime = {}) => ({
  ...DEFAULT_RUNTIME,
  ...runtime,
});

const hydrateNode = (node) => ({
  ...node,
  data: {
    ...(node.data || {}),
    executionConfig: {
      ...DEFAULT_EXECUTION_CONFIG,
      ...((node.data || {}).executionConfig || {}),
    },
    runtime: buildRuntime((node.data || {}).runtime),
  },
});

const hydrateNodes = (nodes) => nodes.map(hydrateNode);
const getLastSelectedId = (items) => items.filter((item) => item.selected).at(-1)?.id || null;

const resetNodeRuntime = (node) => ({
  ...node,
  data: {
    ...node.data,
    runtime: buildRuntime(),
  },
});

const updateNodeRuntime = (node, patch) => ({
  ...node,
  data: {
    ...node.data,
    runtime: {
      ...buildRuntime(node.data?.runtime),
      ...patch,
    },
  },
});

const stringifyValue = (value) => {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 220 ? `${serialized.slice(0, 217)}...` : serialized;
  } catch {
    return String(value);
  }
};

const eventLevelMap = {
  'execution.started': 'INFO',
  'execution.completed': 'SUCCESS',
  'execution.failed': 'ERROR',
  'node.started': 'INFO',
  'node.completed': 'SUCCESS',
  'node.failed': 'ERROR',
  'node.retry_scheduled': 'WARN',
  'node.skipped': 'WARN',
};

const appendExecutionLog = (logs, event, nodes) => {
  const relatedNode = event.node_id ? nodes.find((node) => node.id === event.node_id) : null;
  return [
    ...logs,
    {
      id: `${event.type}-${event.node_id || 'execution'}-${event.timestamp || Date.now()}-${logs.length}`,
      timestamp: event.timestamp,
      level: eventLevelMap[event.type] || 'INFO',
      eventType: event.type,
      nodeId: event.node_id || null,
      nodeLabel: relatedNode?.data?.label || event.node_id || 'Workflow',
      message: event.message || stringifyValue(event.output) || 'Execution event received.',
      attempt: event.attempt || null,
      status: event.status || null,
    },
  ].slice(-250);
};

const initialNodes = hydrateNodes([
  {
    id: 'start-1',
    type: 'triggerNode',
    position: { x: 320, y: 80 },
    data: {
      label: 'Inbound Proposal Payload',
      triggerType: 'manual',
      payloadTemplate: '{}'
    },
  },
  {
    id: 'doc-1',
    type: 'documentClassificationNode',
    position: { x: 220, y: 240 },
    data: {
      label: 'Databricks Document Parse',
      confidence: 94,
      model: 'llama3-70b-8192',
      promptTemplate: 'Extract entities from document.',
      confidenceThreshold: 85.0,
      extractedFields: [
        { key: 'Corporation', value: 'Tesla Inc.' },
        { key: 'GrossMargin', value: '18.2%' },
        { key: 'EBITDA', value: '$14.8B' },
      ],
    },
  },
  {
    id: 'bureau-1',
    type: 'integrationNode',
    position: { x: 260, y: 450 },
    data: {
      label: 'Equifax Commercial',
      connection: 'Risk API Gateway',
      fieldAssignment: 'data.credit_report',
      requestBody: '{\n  "company": "{{ input.applicant_name }}",\n  "revenue": "{{ input.extracted.financial_documents.revenue }}"\n}',
      mockResponse: {
        bureau: 'equifax',
        riskScore: 742,
        approvedLimit: 300000,
      },
      outputMapping: {
        credit_report: {
          riskScore: '{{ response.riskScore }}',
          approvedLimit: '{{ response.approvedLimit }}',
        },
      },
      warning: true,
      warningDetails: 'Retry policy is configured for transient downstream latency.',
    },
  },
  {
    id: 'condition-1',
    type: 'conditionNode',
    position: { x: 300, y: 670 },
    data: {
      label: 'Risk score > 700',
      expression: '{{ nodes.bureau_1.credit_report.riskScore }} > 700',
      assignmentDetails: '{{ nodes.bureau_1.credit_report.riskScore }} > 700',
      targetField: 'data.credit_decision',
      defaultValue: 'REVIEW',
    },
  },
  {
    id: 'explain-1',
    type: 'explainableAINode',
    position: { x: 110, y: 850 },
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
  },
]);

const initialEdges = [
  { id: 'e1-2', source: 'start-1', target: 'doc-1', type: 'smoothstep', animated: true },
  { id: 'e2-3', source: 'doc-1', target: 'bureau-1', type: 'smoothstep', animated: true },
  { id: 'e3-4', source: 'bureau-1', target: 'condition-1', type: 'smoothstep' },
  {
    id: 'e4-5',
    source: 'condition-1',
    sourceHandle: 'true',
    target: 'explain-1',
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#16a34a', strokeWidth: 2 },
  },
];

const removeConnectedEdges = (edges, nodeIds) =>
  edges.filter((edge) => !nodeIds.has(edge.source) && !nodeIds.has(edge.target));

const useWorkflowStore = create((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  selectedNodeId: null,
  selectedEdgeId: null,
  isMappingModalOpen: false,
  mappingConfig: null,
  currentExecutionId: null,
  executionStatus: 'idle',
  executionLogs: [],
  websocketStatus: 'disconnected',
  lastExecutionError: null,
  workflowInitialInput: readWorkflowInitialInput(),

  setSelectedNodeId: (id) => set({ selectedNodeId: id, selectedEdgeId: id ? null : get().selectedEdgeId }),
  setSelectedEdgeId: (id) => set({ selectedEdgeId: id, selectedNodeId: id ? null : get().selectedNodeId }),

  syncSelection: ({ nodes = get().nodes, edges = get().edges }) => set({
    selectedNodeId: getLastSelectedId(nodes),
    selectedEdgeId: getLastSelectedId(edges),
  }),

  setWorkflowInitialInput: (payload) => {
    persistWorkflowInitialInput(payload);
    set({ workflowInitialInput: payload });
  },

  hydrateWorkflowInitialInput: () => set({ workflowInitialInput: readWorkflowInitialInput() }),

  clearWorkflowInitialInput: () => {
    clearWorkflowInitialInputStorage();
    set({ workflowInitialInput: null });
  },

  openMappingModal: (config) => set({
    isMappingModalOpen: true,
    mappingConfig: config || {},
  }),

  closeMappingModal: () => set({
    isMappingModalOpen: false,
    mappingConfig: null,
  }),

  onNodesChange: (changes) => {
    const nextNodes = hydrateNodes(applyNodeChanges(changes, get().nodes));
    set({
      nodes: nextNodes,
      selectedNodeId: getLastSelectedId(nextNodes),
    });
  },

  onEdgesChange: (changes) => {
    const nextEdges = applyEdgeChanges(changes, get().edges);
    set({
      edges: nextEdges,
      selectedEdgeId: getLastSelectedId(nextEdges),
    });
  },

  onNodesDelete: (deletedNodes) => {
    const deletedNodeIds = new Set(deletedNodes.map((node) => node.id));
    set((state) => {
      const nextEdges = removeConnectedEdges(state.edges, deletedNodeIds);
      const edgeIds = new Set(nextEdges.map((edge) => edge.id));
      return {
        nodes: state.nodes.filter((node) => !deletedNodeIds.has(node.id)),
        edges: nextEdges,
        selectedNodeId: state.selectedNodeId && deletedNodeIds.has(state.selectedNodeId) ? null : state.selectedNodeId,
        selectedEdgeId: state.selectedEdgeId && !edgeIds.has(state.selectedEdgeId) ? null : state.selectedEdgeId,
      };
    });
  },

  onEdgesDelete: (deletedEdges) => {
    const deletedEdgeIds = new Set(deletedEdges.map((edge) => edge.id));
    set((state) => ({
      edges: state.edges.filter((edge) => !deletedEdgeIds.has(edge.id)),
      selectedEdgeId: state.selectedEdgeId && deletedEdgeIds.has(state.selectedEdgeId) ? null : state.selectedEdgeId,
    }));
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(
        {
          ...connection,
          type: connection.type || 'smoothstep',
        },
        get().edges,
      ),
    });
  },

  addNode: (node) => {
    const hydratedNode = hydrateNode(node);
    set({
      nodes: [...get().nodes, hydratedNode],
      selectedNodeId: hydratedNode.id,
      selectedEdgeId: null,
    });
  },

  deleteNodeById: (nodeId) => {
    const deletedNodeIds = new Set([nodeId]);
    set((state) => {
      const nextEdges = removeConnectedEdges(state.edges, deletedNodeIds);
      const edgeIds = new Set(nextEdges.map((edge) => edge.id));
      return {
        nodes: state.nodes.filter((node) => node.id !== nodeId),
        edges: nextEdges,
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
        selectedEdgeId: state.selectedEdgeId && !edgeIds.has(state.selectedEdgeId) ? null : state.selectedEdgeId,
      };
    });
  },

  deleteEdgeById: (edgeId) => {
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== edgeId),
      selectedEdgeId: state.selectedEdgeId === edgeId ? null : state.selectedEdgeId,
    }));
  },

  deleteSelectedElements: () => {
    const { selectedNodeId, selectedEdgeId } = get();
    if (selectedNodeId) {
      get().deleteNodeById(selectedNodeId);
      return;
    }
    if (selectedEdgeId) {
      get().deleteEdgeById(selectedEdgeId);
    }
  },

  updateNodeData: (nodeId, dataUpdate) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id !== nodeId) {
          return node;
        }

        const nextData = deepMerge(node.data || {}, dataUpdate || {});
        nextData.executionConfig = {
          ...DEFAULT_EXECUTION_CONFIG,
          ...(nextData.executionConfig || {}),
        };
        nextData.runtime = {
          ...buildRuntime(node.data?.runtime),
          ...(nextData.runtime || {}),
        };

        return hydrateNode({
          ...node,
          data: nextData,
        });
      }),
    });
  },

  resetExecutionState: () => {
    set({
      currentExecutionId: null,
      executionStatus: 'idle',
      executionLogs: [],
      websocketStatus: 'disconnected',
      lastExecutionError: null,
      nodes: get().nodes.map(resetNodeRuntime),
    });
  },

  beginExecution: ({ executionId }) => {
    set({
      currentExecutionId: executionId,
      executionStatus: 'queued',
      executionLogs: [],
      websocketStatus: 'connecting',
      lastExecutionError: null,
      nodes: get().nodes.map(resetNodeRuntime),
    });
  },

  setWebSocketStatus: (status) => set({ websocketStatus: status }),

  applyExecutionEvent: (event) => {
    set((state) => {
      let nextExecutionStatus = state.executionStatus;
      let nextLastExecutionError = state.lastExecutionError;
      let nextNodes = state.nodes;

      if (event.type === 'execution.started') {
        nextExecutionStatus = 'running';
      }

      if (event.type === 'execution.completed') {
        nextExecutionStatus = 'success';
      }

      if (event.type === 'execution.failed') {
        nextExecutionStatus = 'failed';
        nextLastExecutionError = event.error || event.message || 'Workflow execution failed.';
      }

      if (event.node_id) {
        nextNodes = nextNodes.map((node) => {
          if (node.id !== event.node_id) {
            return node;
          }

          if (event.type === 'node.started') {
            return updateNodeRuntime(node, {
              status: 'running',
              attempt: event.attempt || 1,
              message: event.message,
              input: event.input ?? null,
              error: null,
              startedAt: event.started_at || event.timestamp || null,
              finishedAt: null,
              durationMs: null,
            });
          }

          if (event.type === 'node.retry_scheduled') {
            return updateNodeRuntime(node, {
              status: 'retrying',
              attempt: event.attempt || 1,
              message: event.message,
              error: event.error || null,
              finishedAt: event.finished_at || event.timestamp || null,
              durationMs: event.duration_ms ?? null,
            });
          }

          if (event.type === 'node.completed') {
            return updateNodeRuntime(node, {
              status: 'success',
              attempt: event.attempt || 1,
              message: event.message,
              output: event.output ?? null,
              activeHandles: event.active_handles || [],
              error: null,
              finishedAt: event.finished_at || event.timestamp || null,
              durationMs: event.duration_ms ?? null,
            });
          }

          if (event.type === 'node.failed') {
            return updateNodeRuntime(node, {
              status: 'failed',
              attempt: event.attempt || 1,
              message: event.message,
              output: event.output ?? null,
              error: event.error || 'Node execution failed.',
              activeHandles: event.active_handles || [],
              finishedAt: event.finished_at || event.timestamp || null,
              durationMs: event.duration_ms ?? null,
            });
          }

          if (event.type === 'node.skipped') {
            return updateNodeRuntime(node, {
              status: 'skipped',
              message: event.message,
            });
          }

          return node;
        });
      }

      if (event.type === 'execution.completed' && event.final_state?.node_status) {
        nextNodes = nextNodes.map((node) => {
          const finalStatus = event.final_state.node_status[node.id];
          if (!finalStatus || node.data?.runtime?.status !== 'idle') {
            return node;
          }
          return updateNodeRuntime(node, {
            status: finalStatus,
          });
        });
      }

      return {
        currentExecutionId: event.execution_id || state.currentExecutionId,
        executionStatus: nextExecutionStatus,
        executionLogs: appendExecutionLog(state.executionLogs, event, state.nodes),
        lastExecutionError: nextLastExecutionError,
        nodes: nextNodes,
      };
    });
  },
}));

export default useWorkflowStore;

