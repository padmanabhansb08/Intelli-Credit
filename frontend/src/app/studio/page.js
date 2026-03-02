"use client";

import React, { useCallback, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    Panel,
    Position,
    ReactFlowProvider,
    Handle
} from 'reactflow';
import 'reactflow/dist/style.css';
import useWorkflowStore from '@/store/useWorkflowStore';
import PropertiesSidebar from '@/components/studio/PropertiesSidebar';
import DataMappingModal from '@/components/modals/DataMappingModal';
import { Network, ArrowRightLeft, FileCheck, Settings, LogOut, Lock, LayoutGrid, Link, Layers, ArrowRight, RotateCw, Play } from 'lucide-react';
import NextLink from 'next/link';
import { TriggerNode, IntegrationNode, ConditionNode } from '@/components/studio/nodes';

const nodeTypes = {
    triggerNode: TriggerNode,
    integrationNode: IntegrationNode,
    conditionNode: ConditionNode
};

export default function DecisionStudio() {
    const { isMappingModalOpen } = useWorkflowStore();

    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#F8FAFC] flex flex-col font-sans overflow-hidden">
            {/* Top Navigation Bar */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <button className="text-sm font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-2">
                        ← Back to versions
                    </button>
                </div>
            </header>

            {/* Main Stage */}
            <div className="flex flex-1 overflow-hidden relative">

                {/* Visual Canvas Toolbar (Floating Left) */}
                <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                    {/* Toolbar Vertical */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col p-1">
                        <button className="p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 rounded-md"><Lock className="w-4 h-4" /></button>
                        <button className="p-2 bg-blue-50 text-blue-600 rounded-md"><LayoutGrid className="w-4 h-4" /></button>
                        <button className="p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 rounded-md"><Link className="w-4 h-4" /></button>
                    </div>

                    {/* Node Search / Title */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 px-4 shadow-sm w-80 flex items-center mt-2">
                        <span className="text-sm font-medium text-slate-700">Draft</span>
                    </div>

                    {/* Draggable Node Palette */}
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
                            className="p-2 hover:bg-slate-100 rounded-md cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-200 flex items-center justify-center bg-teal-50 shadow-sm"
                            onDragStart={(event) => onDragStart(event, 'integrationNode')}
                            draggable
                            title="Drag Integration (API) Node"
                        >
                            <Layers className="w-5 h-5 text-teal-600" />
                        </div>
                        <div
                            className="p-2 hover:bg-slate-100 rounded-md cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-200 flex items-center justify-center bg-indigo-50 shadow-sm"
                            onDragStart={(event) => onDragStart(event, 'conditionNode')}
                            draggable
                            title="Drag Logic/Condition Node"
                        >
                            <Network className="w-5 h-5 text-indigo-600" />
                        </div>
                    </div>
                </div>

                {/* The React Flow Canvas */}
                <div className="flex-1 bg-[#F4F5F7] h-full">
                    <ReactFlowProvider>
                        <DnDFlowContainer />
                    </ReactFlowProvider>
                </div>

                {/* Right Properties Sidebar */}
                <PropertiesSidebar />
            </div>

            {/* Render 3-Column Mapper Modal */}
            {isMappingModalOpen && <DataMappingModal />}
        </div>
    );
}

// Sub-component wrapper to consume ReactFlowProvider hooks
function DnDFlowContainer() {
    const [reactFlowInstance, setReactFlowInstance] = useState(null);
    const {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        setSelectedNodeId,
        addNode
    } = useWorkflowStore();

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

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();
            if (!reactFlowInstance) return;

            const type = event.dataTransfer.getData('application/reactflow');
            if (typeof type === 'undefined' || !type) return;

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            let newLabel = 'New Node';
            let extraData = {};
            if (type === 'triggerNode') {
                newLabel = 'Trigger Event';
            } else if (type === 'integrationNode') {
                newLabel = 'Integration API';
                extraData = { connection: 'Select Connection...', fieldAssignment: 'data.untitled' };
            } else if (type === 'conditionNode') {
                newLabel = 'Condition Rule';
                extraData = { assignmentDetails: 'Assignment', rules: [], targetField: 'data.decision', defaultValue: '' };
            }

            const newNode = {
                id: `${type}-${Math.random().toString(36).substr(2, 9)}`,
                type,
                position,
                data: { label: newLabel, ...extraData },
            };

            addNode(newNode);
        },
        [reactFlowInstance, addNode]
    );

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
            <Background color="#ccc" gap={20} size={1} />
            <Controls className="!bg-white !border-slate-200 !shadow-sm" />
        </ReactFlow>
    );
}
