import React, { useMemo } from 'react';
import { useDecisionStore } from '@/store/useDecisionStore';
import { useShallow } from 'zustand/react/shallow';
import { CustomWidgetRenderer } from './CustomWidgetRenderer';

import { getSchemaForNodeType } from './NodeSchema';

const DynamicPanel = ({ node, executionData }) => {
    const updateNodeData = useDecisionStore((state) => state.updateNodeData);
    const schema = getSchemaForNodeType(node.type);

    if (!schema) {
        return (
            <div className="p-4 bg-slate-100 border rounded-md shadow-sm mb-4">
                <h3 className="font-bold text-sm text-slate-800">Unknown Node</h3>
                <p className="text-xs text-slate-500 mt-1">{node.id}</p>
            </div>
        );
    }

    const handleFieldChange = (key, value) => {
        updateNodeData(node.id, { [key]: value });
    };

    return (
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm mb-4 transition-all hover:shadow-md">
            <h3 className="font-bold text-sm text-slate-800 border-b pb-2 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                {schema.title}
            </h3>

            {/* Custom UI tailored for the precise functionality of the Node rather than generic schema dumps */}
            <CustomWidgetRenderer node={node} updateNodeData={updateNodeData} executionData={executionData} />

        </div>
    );
};

export const Workspace = React.memo(() => {
    // Subscribe specifically to the activeWorkflowNodes using useShallow
    // to prevent re-renders on arbitrary coordinate updates of nodes in the graph
    const activeNodes = useDecisionStore(
        useShallow((state) => state.activeWorkflowNodes)
    );
    const latestExecutionContext = useDecisionStore((state) => state.latestExecutionContext);

    return (
        <div className="w-80 h-full border-l border-slate-200 bg-slate-50 overflow-y-auto p-4 flex flex-col">
            <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-900">Active Workflow</h2>
                <p className="text-xs text-slate-500 mt-1">
                    {activeNodes.length === 0
                        ? 'Connect nodes to the root trigger to build your workflow.'
                        : `Executing ${activeNodes.length} active nodes.`}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {activeNodes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-center border-2 border-dashed border-slate-200 rounded-xl bg-white">
                        <p className="text-sm font-medium">No nodes connected</p>
                        <p className="text-xs mt-1">Drag and connect nodes to begin.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {activeNodes.map((node) => (
                            <DynamicPanel key={node.id} node={node} executionData={latestExecutionContext} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});

Workspace.displayName = 'Workspace';

export default Workspace;
