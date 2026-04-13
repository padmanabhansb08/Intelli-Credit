import { create } from 'zustand';
import { broadcast } from './broadcastMiddleware';

export interface CreditRecord {
    analysis_id: string;
    company_name: string;
    decision: any;
    risk_premium: any;
}

export interface NodeWorkflowData {
    nodes: any[];
    edges: any[];
}

export interface AppState {
    // Session Identity
    authToken: string | null;
    setAuthToken: (token: string | null) => void;

    // Active Workspace Credit Record
    activeRecord: CreditRecord | null;
    setActiveRecord: (record: CreditRecord | null) => void;

    // Active Decision Studio Graph Topography
    workflowData: NodeWorkflowData | null;
    setWorkflowData: (data: NodeWorkflowData | null) => void;

    // Private Sync Commit Action (used only by useTabSync hook)
    __syncState: (payload: Partial<AppState>) => void;
}

export const useStore = create<AppState>()(
    broadcast('intelli-credit-state-sync', (set) => ({
        // Initial States
        authToken: null,
        activeRecord: null,
        workflowData: null,

        // Mutators
        setAuthToken: (token) => set({ authToken: token }),
        setActiveRecord: (record) => set({ activeRecord: record }),
        setWorkflowData: (data) => set({ workflowData: data }),

        // Private Synchronizer (used by useTabSync to apply remote state silently)
        __syncState: (payload) => (set as any)(payload, false)
    }))
);
