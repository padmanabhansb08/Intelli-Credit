import { create } from 'zustand';
import {
    Connection,
    Edge,
    EdgeChange,
    Node,
    NodeChange,
    addEdge,
    applyEdgeChanges,
    applyNodeChanges,
} from 'reactflow';

export interface DecisionStoreState {
    nodes: Node[];
    edges: Edge[];
    activeWorkflowNodes: Node[];

    // Actions
    onNodesChange: (changes: NodeChange[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection | Edge) => void;
    onNodesDelete: (deleted: Node[]) => void;

    // BFS Traversal
    computeActiveWorkflow: () => void;

    // Dynamic form update action
    updateNodeData: (id: string, newData: any) => void;
}

// Helper to find nodes connected to the root trigger
const computeActiveWorkflowBFS = (nodes: Node[], edges: Edge[]): Node[] => {
    // Assuming the trigger node is the root. We can find it by type 'triggerNode'
    const rootNode = nodes.find((n) => n.type === 'triggerNode');

    if (!rootNode) {
        return []; // No active workflow if no trigger exists
    }

    const activeNodes = new Set<string>();
    const queue: string[] = [rootNode.id];

    // Adjacency list for fast neighbor lookup
    const graph: Record<string, string[]> = {};
    for (const node of nodes) {
        graph[node.id] = [];
    }

    for (const edge of edges) {
        if (graph[edge.source]) {
            graph[edge.source].push(edge.target);
        }
    }

    // BFS Traversal
    while (queue.length > 0) {
        const currentId = queue.shift()!;

        if (!activeNodes.has(currentId)) {
            activeNodes.add(currentId);

            const neighbors = graph[currentId] || [];
            for (const neighborId of neighbors) {
                if (!activeNodes.has(neighborId)) {
                    queue.push(neighborId);
                }
            }
        }
    }

    // Return nodes that are in the active set
    return nodes.filter(node => activeNodes.has(node.id));
};

export const useDecisionStore = create<DecisionStoreState>((set, get) => ({
    nodes: [],
    edges: [],
    activeWorkflowNodes: [],

    onNodesChange: (changes) => {
        set({
            nodes: applyNodeChanges(changes, get().nodes),
        });
        // Node changes (like position) usually don't affect topology, 
        // but deleting a node does, which is handled in onNodesDelete.
        // However, we recompute just in case nodes are added via API.
        get().computeActiveWorkflow();
    },

    onEdgesChange: (changes) => {
        set({
            edges: applyEdgeChanges(changes, get().edges),
        });
        get().computeActiveWorkflow();
    },

    onConnect: (connection) => {
        set({
            edges: addEdge(connection, get().edges),
        });
        get().computeActiveWorkflow();
    },

    onNodesDelete: (deleted) => {
        const deletedIds = deleted.map((n) => n.id);
        set({
            nodes: get().nodes.filter((n) => !deletedIds.includes(n.id)),
            edges: get().edges.filter(
                (e) => !deletedIds.includes(e.source) && !deletedIds.includes(e.target)
            ),
        });
        get().computeActiveWorkflow();
    },

    computeActiveWorkflow: () => {
        const { nodes, edges } = get();
        const activeWorkflowNodes = computeActiveWorkflowBFS(nodes, edges);
        set({ activeWorkflowNodes });
    },

    updateNodeData: (id, newData) => {
        set({
            nodes: get().nodes.map((node) => {
                if (node.id === id) {
                    // Deep clone using JSON stringify/parse to strictly avoid React Flow shallow comparison bugs
                    const clonedNode = JSON.parse(JSON.stringify(node));
                    return {
                        ...clonedNode,
                        data: {
                            ...clonedNode.data,
                            ...newData,
                        },
                    };
                }
                return node;
            }),
        });

        // Re-run the active node computation based on the NEW nodes array
        get().computeActiveWorkflow();
    },
}));
