import { create } from 'zustand';
import {
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
} from 'reactflow';

const initialNodes = [
    {
        id: 'start-1',
        type: 'triggerNode',
        position: { x: 300, y: 50 },
        data: { label: 'Inbound Proposal PDF' },
    },
    {
        id: 'doc-1',
        type: 'documentClassificationNode',
        position: { x: 190, y: 200 },
        data: {
            label: '10-K & Income Statement',
            confidence: 94,
            extractedFields: [
                { key: 'Corporation', value: 'Tesla Inc.' },
                { key: 'GrossMargin', value: '18.2%' },
                { key: 'EBITDA', value: '$14.8B' }
            ]
        }
    },
    {
        id: 'bureau-1',
        type: 'integrationNode',
        position: { x: 230, y: 400 },
        data: {
            label: 'Equifax Commercial',
            connection: 'Risk API Gateway',
            warning: true,
            warningDetails: 'Retrying connection... latency 405ms'
        },
    },
    {
        id: 'condition-1',
        type: 'conditionNode',
        position: { x: 250, y: 560 },
        data: {
            label: 'DSCR > 1.25',
            assignmentDetails: 'if (EBITDA / DebtService > 1.25)'
        },
    },
    {
        id: 'explain-1',
        type: 'explainableAINode',
        position: { x: 50, y: 730 },
        data: {
            label: 'TreeSHAP Attributions',
            shapValues: [
                { name: "Debt-to-Income", impact: 1.84 },
                { name: "Years in Business", impact: -0.65 },
                { name: "Revolving Util", impact: 0.92 }
            ]
        },
    }
];

const initialEdges = [
    { id: 'e1-2', source: 'start-1', target: 'doc-1', type: 'smoothstep', animated: true },
    { id: 'e2-3', source: 'doc-1', target: 'bureau-1', type: 'smoothstep', animated: true },
    { id: 'e3-4', source: 'bureau-1', target: 'condition-1', type: 'smoothstep' },
    { id: 'e4-5', source: 'condition-1', sourceHandle: 'false', target: 'explain-1', type: 'smoothstep', animated: true, style: { stroke: '#f43f5e', strokeWidth: 2 } }
];

const useWorkflowStore = create((set, get) => ({
    nodes: initialNodes,
    edges: initialEdges,
    selectedNodeId: null,

    // Selected node logic
    setSelectedNodeId: (id) => set({ selectedNodeId: id }),

    // Data Mapping Modal State
    isMappingModalOpen: false,
    mappingConfig: null,

    openMappingModal: (config) => set({
        isMappingModalOpen: true,
        mappingConfig: config || {}
    }),

    closeMappingModal: () => set({
        isMappingModalOpen: false,
        mappingConfig: null
    }),

    // Actions for React Flow
    onNodesChange: (changes) => {
        set({
            nodes: applyNodeChanges(changes, get().nodes),
        });
    },
    onEdgesChange: (changes) => {
        set({
            edges: applyEdgeChanges(changes, get().edges),
        });
    },
    onConnect: (connection) => {
        set({
            edges: addEdge(connection, get().edges),
        });
    },

    addNode: (node) => {
        set({
            nodes: [...get().nodes, node]
        });
    },

    // Custom updates
    updateNodeData: (nodeId, dataUpdate) => {
        set({
            nodes: get().nodes.map((node) => {
                if (node.id === nodeId) {
                    // It's important to create a new object here, to inform React Flow about the change
                    return { ...node, data: { ...node.data, ...dataUpdate } };
                }
                return node;
            }),
        });
    },
}));

export default useWorkflowStore;
