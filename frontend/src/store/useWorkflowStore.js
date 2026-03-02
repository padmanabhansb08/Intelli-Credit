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
        position: { x: 250, y: 100 },
        data: { label: 'Start Application' },
    },
    {
        id: 'bureau-1',
        type: 'integrationNode',
        position: { x: 250, y: 250 },
        data: {
            label: 'Credit Bureau',
            connection: 'Credit Bureau',
            fieldAssignment: 'data.credit_report',
            warning: true
        },
    },
    {
        id: 'condition-1',
        type: 'conditionNode',
        position: { x: 250, y: 400 },
        data: {
            label: 'Condition Rule',
            assignmentDetails: 'Assignment',
            warning: true,
            rules: [],
            targetField: 'data.credit_decision',
            defaultValue: ''
        },
    }
];

const initialEdges = [
    { id: 'e1-2', source: 'start-1', target: 'bureau-1', type: 'smoothstep' },
    { id: 'e2-3', source: 'bureau-1', target: 'condition-1', type: 'smoothstep' }
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
