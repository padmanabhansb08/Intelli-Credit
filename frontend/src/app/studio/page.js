"use client";

import React, { useCallback, useState, useEffect } from 'react';
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
import { Network, ArrowRightLeft, FileCheck, Settings, LogOut, Lock, LayoutGrid, Link, Layers, ArrowRight, RotateCw, Play, Coins, Share2, PanelBottomClose, PanelBottomOpen, FileTerminal } from 'lucide-react';
import useWorkflowStore from '@/store/useWorkflowStore';
import PropertiesSidebar from '@/components/studio/PropertiesSidebar';
import DataMappingModal from '@/components/modals/DataMappingModal';
import NextLink from 'next/link';
import { TriggerNode, IntegrationNode, ConditionNode, DocumentClassificationNode, ExplainableAINode } from '@/components/studio/nodes';

const nodeTypes = {
    triggerNode: TriggerNode,
    integrationNode: IntegrationNode,
    conditionNode: ConditionNode,
    documentClassificationNode: DocumentClassificationNode,
    explainableAINode: ExplainableAINode
};

export default function DecisionStudio() {
    const { isMappingModalOpen, nodes, edges } = useWorkflowStore();
    const [isDeploying, setIsDeploying] = useState(false);
    const [costEstimate, setCostEstimate] = useState(null);
    const [isEstimating, setIsEstimating] = useState(false);

    // Debounced cost estimation
    useEffect(() => {
        const fetchCost = async () => {
            if (nodes.length === 0) return;
            setIsEstimating(true);
            try {
                const response = await fetch('http://localhost:8000/api/studio/estimate_cost', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nodes, edges })
                });
                if (response.ok) {
                    const data = await response.json();
                    setCostEstimate(data);
                }
            } catch (error) {
                console.error("Failed to estimate costs:", error);
            } finally {
                setIsEstimating(false);
            }
        };

        const timer = setTimeout(fetchCost, 800);
        return () => clearTimeout(timer);
    }, [nodes, edges]);

    const handleDeploy = async () => {
        setIsDeploying(true);
        try {
            const payload = {
                nodes: nodes,
                edges: edges,
                workflow_id: 'draft_' + Date.now()
            };

            const response = await fetch('http://localhost:8000/api/studio/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (response.ok) {
                // Populate the Traceability Log window with mock traces, simulating a backend streaming response
                setIsTracePanelOpen(true);
                setPipelineLogs([
                    { timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19), level: 'INFO', node: 'TriggerEvent', message: 'Workflow execution initiated.' },
                    { timestamp: new Date(Date.now() + 150).toISOString().replace('T', ' ').substring(0, 19), level: 'INFO', node: 'IDP_SciBERT', message: 'Extracting named entities from structured payload.' },
                    { timestamp: new Date(Date.now() + 450).toISOString().replace('T', ' ').substring(0, 19), level: 'SUCCESS', node: 'IDP_SciBERT', message: 'Payload parsed. High confidence bounds (96%).' },
                    { timestamp: new Date(Date.now() + 600).toISOString().replace('T', ' ').substring(0, 19), level: 'INFO', node: 'ConditionRules', message: 'Routing evaluated: DSCR > 1.25. Proceeding to Model Inference.' },
                    { timestamp: new Date(Date.now() + 1100).toISOString().replace('T', ' ').substring(0, 19), level: 'WARN', node: 'TreeSHAP_Explainer', message: 'Platt scaling applied. DTI impact highly non-linear in this region.' },
                    { timestamp: new Date(Date.now() + 1300).toISOString().replace('T', ' ').substring(0, 19), level: 'SUCCESS', node: 'API_Gateway', message: 'Core Banking webhook fired. HTTP 200 OK.' },
                    { timestamp: new Date(Date.now() + 1350).toISOString().replace('T', ' ').substring(0, 19), level: 'SUCCESS', node: 'Orchestrator', message: 'Workflow Run complete. Total compute: 2453 tokens.' }
                ]);
            } else {
                alert('Failed to execute: ' + data.detail);
            }
        } catch (error) {
            console.error(error);
            alert('Failed to connect to execution engine.');
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
            {/* Top Navigation Bar */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <button className="text-sm font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-2">
                        ← Back to versions
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    {/* Cost Estimation Widget */}
                    <div className="flex flex-col items-end mr-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                            <Coins className="w-4 h-4 text-amber-500" />
                            <span className="text-sm font-bold">
                                {isEstimating ? 'Estimating...' : (costEstimate ? `${costEstimate.total_credits} AI Credits` : '0 AI Credits')}
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
                        {isDeploying ? 'Deploying...' : <><Play className="w-3.5 h-3.5 fill-current" /> Deploy workflow</>}
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
                        <div
                            className="p-2 hover:bg-slate-100 rounded-md cursor-grab active:cursor-grabbing border border-transparent hover:border-slate-200 flex items-center justify-center bg-amber-50 shadow-sm"
                            onDragStart={(event) => onDragStart(event, 'explainableAINode')}
                            draggable
                            title="Drag Explainable AI (TreeSHAP) Node"
                        >
                            <Share2 className="w-5 h-5 text-amber-600" />
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
            } else if (type === 'documentClassificationNode') {
                newLabel = 'Proposal Parser';
                extraData = {
                    confidence: 96,
                    extractedFields: [
                        { key: 'Applicant', value: 'ACME Corp' },
                        { key: 'Requested', value: '$250,000' }
                    ]
                };
            } else if (type === 'explainableAINode') {
                newLabel = 'TreeSHAP Attributions';
                extraData = {
                    shapValues: [
                        { name: "Debt-to-Income", impact: 1.84 },
                        { name: "Years in Business", impact: -0.65 },
                        { name: "Revolving Util", impact: 0.92 }
                    ]
                };
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
