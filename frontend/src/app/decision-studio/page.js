'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    addEdge,
    useNodesState,
    useEdgesState,
    ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useAuth } from '../../context/AuthContext';
import PolicyConditionNode from '../../components/decision-studio/PolicyConditionNode';
import PolicyDecisionNode from '../../components/decision-studio/PolicyDecisionNode';
import {
    GitBranch,
    CheckCircle2,
    Send,
    Loader2,
    AlertCircle,
    CheckCircle,
    Plus,
    ArrowLeft,
    Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import NextLink from 'next/link';

const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Node type registry ──────────────────────────────────────────────────────

const nodeTypes = {
    policyCondition: PolicyConditionNode,
    policyDecision: PolicyDecisionNode,
};

// ── Edge validation utilities ───────────────────────────────────────────────

function wouldCreateCycle(nodes, edges, source, target) {
    const adjacency = {};
    for (const edge of edges) {
        if (!adjacency[edge.source]) adjacency[edge.source] = [];
        adjacency[edge.source].push(edge.target);
    }
    if (!adjacency[source]) adjacency[source] = [];
    adjacency[source].push(target);

    const visited = new Set();
    const stack = new Set();

    function dfs(nodeId) {
        if (stack.has(nodeId)) return true;
        if (visited.has(nodeId)) return false;
        visited.add(nodeId);
        stack.add(nodeId);
        for (const neighbor of (adjacency[nodeId] || [])) {
            if (dfs(neighbor)) return true;
        }
        stack.delete(nodeId);
        return false;
    }

    for (const node of nodes) {
        if (dfs(node.id)) return true;
    }
    return false;
}

function getUnlinkedConditionNodes(nodes, edges) {
    const conditionNodes = nodes.filter(n => n.type === 'policyCondition');
    const unlinked = [];
    for (const node of conditionNodes) {
        const outgoing = edges.filter(e => e.source === node.id);
        const hasTrue = outgoing.some(e => e.sourceHandle === 'on_true');
        const hasFalse = outgoing.some(e => e.sourceHandle === 'on_false');
        if (!hasTrue || !hasFalse) {
            unlinked.push(node.id);
        }
    }
    return unlinked;
}

// ── Serialization: React Flow graph → Backend policy schema ─────────────────

function serializeToPolicySchema(nodes, edges) {
    const nodeMap = {};
    for (const n of nodes) nodeMap[n.id] = n;

    const roots = nodes.filter(n => !edges.some(e => e.target === n.id));

    function buildBranch(targetNodeId) {
        const targetNode = nodeMap[targetNodeId];
        if (!targetNode) return null;

        if (targetNode.type === 'policyDecision') {
            return {
                action: 'decision',
                decision: targetNode.data.decision || 'MANUAL_REVIEW',
                reason: targetNode.data.reason || '',
            };
        }

        if (targetNode.type === 'policyCondition') {
            const childRules = buildRules(targetNodeId);
            return {
                action: 'continue',
                next_rules: childRules,
            };
        }
        return null;
    }

    function buildRules(parentId) {
        const relevantNodes = parentId
            ? [nodeMap[parentId]]
            : roots.filter(n => n.type === 'policyCondition');

        return relevantNodes.filter(Boolean).map(node => {
            const trueEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'on_true');
            const falseEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'on_false');

            return {
                id: node.id,
                label: node.data.label || 'Condition',
                field: node.data.field || '',
                operator: node.data.operator || '>=',
                value: isNaN(Number(node.data.value)) ? node.data.value : Number(node.data.value),
                on_true: trueEdge ? buildBranch(trueEdge.target) : null,
                on_false: falseEdge ? buildBranch(falseEdge.target) : null,
            };
        });
    }

    return {
        rules: buildRules(null),
        default_decision: 'MANUAL_REVIEW',
    };
}

// ── ID Generator ────────────────────────────────────────────────────────────

let nodeIdCounter = 0;
const generateId = (prefix) => `${prefix}-${++nodeIdCounter}-${Date.now().toString(36)}`;

// ── Default nodes ───────────────────────────────────────────────────────────

const defaultNodes = [
    {
        id: 'cond-1',
        type: 'policyCondition',
        position: { x: 250, y: 40 },
        data: { label: 'DSCR Check', field: 'dscr', operator: '>=', value: '1.25' },
    },
    {
        id: 'dec-approve',
        type: 'policyDecision',
        position: { x: 80, y: 350 },
        data: { decision: 'APPROVE', reason: 'DSCR meets threshold' },
    },
    {
        id: 'dec-reject',
        type: 'policyDecision',
        position: { x: 420, y: 350 },
        data: { decision: 'REJECT', reason: 'DSCR below acceptable limit' },
    },
];

const defaultEdges = [
    { id: 'e-cond1-approve', source: 'cond-1', sourceHandle: 'on_true', target: 'dec-approve', type: 'smoothstep', animated: true, style: { stroke: '#10b981', strokeWidth: 2 } },
    { id: 'e-cond1-reject', source: 'cond-1', sourceHandle: 'on_false', target: 'dec-reject', type: 'smoothstep', animated: true, style: { stroke: '#f43f5e', strokeWidth: 2 } },
];

// ── Main Component ──────────────────────────────────────────────────────────

function DecisionStudioInner() {
    const { user } = useAuth();
    const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
    const [policyName, setPolicyName] = useState('');
    const [toast, setToast] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cycleWarning, setCycleWarning] = useState(false);
    const reactFlowWrapper = useRef(null);
    const [rfInstance, setRfInstance] = useState(null);

    const showToast = useCallback((type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    }, []);

    // Node update callback passed to custom nodes
    const handleNodeUpdate = useCallback((nodeId, newData) => {
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...newData, onUpdate: n.data.onUpdate } } : n));
    }, [setNodes]);

    // Inject onUpdate callback into all nodes
    const nodesWithCallbacks = useMemo(() =>
        nodes.map(n => ({ ...n, data: { ...n.data, onUpdate: handleNodeUpdate } })),
        [nodes, handleNodeUpdate]
    );

    // ── AI Generation Logic ──────────────────────────────────────────────────
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Deserializes backend rule schema into React Flow Nodes/Edges
    const deserializeGraph = useCallback((schema) => {
        const newNodes = [];
        const newEdges = [];
        let yOffset = 100;

        // Recursive Traversal
        function traverse(rule, _x, _y, parentId = null, sourceHandle = null) {
            if (!rule) return null;

            const nodeId = `ai-cond-${Math.random().toString(36).substr(2, 9)}`;

            // Create condition node
            newNodes.push({
                id: nodeId,
                type: 'policyCondition',
                position: { x: _x, y: _y },
                data: {
                    label: rule.label || 'Condition',
                    field: rule.field || '',
                    operator: rule.operator || '>=',
                    value: rule.value?.toString() || ''
                }
            });

            if (parentId && sourceHandle) {
                newEdges.push({
                    id: `ai-e-${parentId}-${nodeId}`,
                    source: parentId,
                    sourceHandle,
                    target: nodeId,
                    type: 'smoothstep',
                    animated: true,
                    style: { stroke: sourceHandle === 'on_true' ? '#10b981' : '#f43f5e', strokeWidth: 2 }
                });
            }

            yOffset = Math.max(yOffset, _y + 200);

            // Process True Branch
            if (rule.on_true) {
                if (rule.on_true.action === 'decision') {
                    const decId = `ai-dec-${Math.random().toString(36).substr(2, 9)}`;
                    newNodes.push({
                        id: decId,
                        type: 'policyDecision',
                        position: { x: _x - 150, y: _y + 200 },
                        data: { decision: rule.on_true.decision, reason: rule.on_true.reason || '' }
                    });
                    newEdges.push({
                        id: `ai-e-${nodeId}-true`,
                        source: nodeId,
                        sourceHandle: 'on_true',
                        target: decId,
                        type: 'smoothstep',
                        animated: true,
                        style: { stroke: '#10b981', strokeWidth: 2 }
                    });
                } else if (rule.on_true.action === 'continue' && rule.on_true.next_rules?.length) {
                    traverse(rule.on_true.next_rules[0], _x - 200, _y + 200, nodeId, 'on_true');
                }
            }

            // Process False Branch
            if (rule.on_false) {
                if (rule.on_false.action === 'decision') {
                    const decId = `ai-dec-${Math.random().toString(36).substr(2, 9)}`;
                    newNodes.push({
                        id: decId,
                        type: 'policyDecision',
                        position: { x: _x + 200, y: _y + 200 },
                        data: { decision: rule.on_false.decision, reason: rule.on_false.reason || '' }
                    });
                    newEdges.push({
                        id: `ai-e-${nodeId}-false`,
                        source: nodeId,
                        sourceHandle: 'on_false',
                        target: decId,
                        type: 'smoothstep',
                        animated: true,
                        style: { stroke: '#f43f5e', strokeWidth: 2 }
                    });
                } else if (rule.on_false.action === 'continue' && rule.on_false.next_rules?.length) {
                    traverse(rule.on_false.next_rules[0], _x + 250, _y + 200, nodeId, 'on_false');
                }
            }
            return nodeId;
        }

        if (schema.rules && schema.rules.length > 0) {
            traverse(schema.rules[0], 250, 100);
        }

        return { newNodes, newEdges };
    }, []);

    const handleAIGenerate = async (e) => {
        e.preventDefault();
        if (!aiPrompt.trim()) return;

        setIsGenerating(true);
        showToast('success', 'Sending prompt to AI... this takes a few seconds.');

        try {
            const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v2/policies/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiPrompt.trim() }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || `Server returned ${res.status}`);
            }

            const schema = await res.json();

            // Parse JSON into React Flow
            const { newNodes, newEdges } = deserializeGraph(schema);
            if (newNodes.length > 0) {
                setNodes(newNodes);
                setEdges(newEdges);
                setAiPrompt('');
                showToast('success', 'AI graph generated successfully!');
                if (rfInstance) {
                    setTimeout(() => rfInstance.fitView({ padding: 0.2, duration: 800 }), 100);
                }
            } else {
                throw new Error('AI returned a valid schema but no rules were found.');
            }

        } catch (err) {
            showToast('error', `AI Generation Error: ${err.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    // Edge connection with cycle detection
    const onConnect = useCallback((params) => {
        if (wouldCreateCycle(nodes, edges, params.source, params.target)) {
            setCycleWarning(true);
            setTimeout(() => setCycleWarning(false), 3000);
            showToast('error', 'Connection rejected — circular loop detected!');
            return;
        }

        const edgeStyle = params.sourceHandle === 'on_true'
            ? { stroke: '#10b981', strokeWidth: 2 }
            : params.sourceHandle === 'on_false'
                ? { stroke: '#f43f5e', strokeWidth: 2 }
                : { stroke: '#6366f1', strokeWidth: 2 };

        setEdges(eds => addEdge({
            ...params,
            type: 'smoothstep',
            animated: true,
            style: edgeStyle,
        }, eds));
    }, [nodes, edges, setEdges, showToast]);

    // Add condition node
    const addConditionNode = useCallback(() => {
        const id = generateId('cond');
        setNodes(nds => [...nds, {
            id,
            type: 'policyCondition',
            position: { x: 250 + Math.random() * 100, y: 100 + nds.length * 60 },
            data: { label: 'New Condition', field: '', operator: '>=', value: '' },
        }]);
    }, [setNodes]);

    // Add decision node
    const addDecisionNode = useCallback(() => {
        const id = generateId('dec');
        setNodes(nds => [...nds, {
            id,
            type: 'policyDecision',
            position: { x: 250 + Math.random() * 100, y: 300 + nds.length * 60 },
            data: { decision: 'MANUAL_REVIEW', reason: '' },
        }]);
    }, [setNodes]);

    // Unlinked node detection
    const unlinked = useMemo(() => getUnlinkedConditionNodes(nodes, edges), [nodes, edges]);

    // Submit for Review
    const handleSubmit = useCallback(async () => {
        if (!policyName.trim()) {
            showToast('error', 'Please enter a policy name before submitting.');
            return;
        }

        if (unlinked.length > 0) {
            showToast('error', `${unlinked.length} condition node(s) have unlinked TRUE/FALSE branches. Connect all branches before submitting.`);
            return;
        }

        const conditionNodes = nodes.filter(n => n.type === 'policyCondition');
        for (const node of conditionNodes) {
            if (!node.data.field || !node.data.value) {
                showToast('error', `Condition node "${node.data.label}" has empty attribute or threshold.`);
                return;
            }
        }

        setIsSubmitting(true);

        try {
            const schema = serializeToPolicySchema(nodes, edges);
            const token = user ? await user.getIdToken() : null;

            const res = await fetch(`${NEXT_PUBLIC_API_URL}/api/v2/policies`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                    'Idempotency-Key': `policy-${Date.now()}`,
                },
                body: JSON.stringify({
                    name: policyName.trim(),
                    rule_schema: schema,
                }),
            });

            if (res.status === 201) {
                const data = await res.json();
                showToast('success', `Policy "${data.name}" created successfully (v${data.version})!`);
            } else if (res.status === 422) {
                const err = await res.json();
                showToast('error', `Validation failed: ${err.detail?.[0]?.msg || JSON.stringify(err.detail)}`);
            } else {
                showToast('error', `Server returned ${res.status}. Please try again.`);
            }
        } catch (err) {
            showToast('error', `Network error: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    }, [policyName, nodes, edges, unlinked, user, showToast]);

    return (
        <div className="fixed inset-0 z-[100] bg-[#0f0f14] flex flex-col font-sans overflow-hidden">
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <header className="h-16 bg-[#1a1a24] border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <NextLink href="/" className="text-sm font-medium text-slate-400 hover:text-white flex items-center gap-2 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </NextLink>
                    <div className="h-6 w-px bg-white/10" />
                    <div className="flex items-center gap-2">
                        <GitBranch className="w-5 h-5 text-violet-400" />
                        <span className="text-base font-bold text-white tracking-tight">Decision Studio</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        value={policyName}
                        onChange={(e) => setPolicyName(e.target.value)}
                        placeholder="Policy name…"
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-slate-500 w-56 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                    />

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-violet-500/20"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {isSubmitting ? 'Submitting…' : 'Submit for Review'}
                    </button>
                </div>
            </header>

            {/* ── Canvas ──────────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* AI Prompt Bar */}
                <div className="bg-[#13131b] border-b border-white/5 py-3 px-6 shrink-0 flex items-center justify-center shadow-lg z-10">
                    <form onSubmit={handleAIGenerate} className="flex items-center gap-3 w-full max-w-4xl">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="Describe your policy (e.g., 'Approve if DSCR > 1.25 and Bureau Score >= 700, else manual review')"
                                className="w-full bg-[#1a1a24] border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all font-medium placeholder:text-slate-500 shadow-inner"
                                disabled={isGenerating}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-md bg-white/5 border border-white/10">
                                <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">AI</span>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isGenerating || !aiPrompt.trim()}
                            className="bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-900 px-5 py-3 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2"
                        >
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin text-violet-600" /> : <GitBranch className="w-4 h-4 text-violet-600" />}
                            {isGenerating ? 'Generating...' : 'Build Graph'}
                        </button>
                    </form>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar — add nodes */}
                    <div className="w-56 bg-[#13131b] border-r border-white/5 p-4 flex flex-col gap-3 shrink-0">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Add Nodes</span>

                        <button
                            onClick={addConditionNode}
                            className="flex items-center gap-3 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-xl px-3 py-3 text-sm font-semibold text-violet-300 transition-all group"
                        >
                            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center group-hover:bg-violet-500/30 transition-colors">
                                <Plus className="w-4 h-4" />
                            </div>
                            Condition
                        </button>

                        <button
                            onClick={addDecisionNode}
                            className="flex items-center gap-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl px-3 py-3 text-sm font-semibold text-emerald-300 transition-all group"
                        >
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors">
                                <Plus className="w-4 h-4" />
                            </div>
                            Decision
                        </button>

                        {/* Unlinked warnings */}
                        {unlinked.length > 0 && (
                            <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                                <div className="flex items-center gap-2 text-amber-400 mb-2">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Unlinked</span>
                                </div>
                                {unlinked.map(id => (
                                    <div key={id} className="text-[11px] text-amber-300/80 font-mono truncate">{id}</div>
                                ))}
                            </div>
                        )}

                        {cycleWarning && (
                            <div className="mt-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                                <div className="flex items-center gap-2 text-rose-400">
                                    <AlertCircle className="w-4 h-4 animate-pulse" />
                                    <span className="text-xs font-bold">Cycle blocked!</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* React Flow Canvas */}
                    <div className="flex-1" ref={reactFlowWrapper}>
                        <ReactFlow
                            nodes={nodesWithCallbacks}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onInit={setRfInstance}
                            nodeTypes={nodeTypes}
                            fitView
                            deleteKeyCode={['Backspace', 'Delete']}
                            className="bg-[#0d0d12]"
                            defaultEdgeOptions={{ type: 'smoothstep', animated: true }}
                            proOptions={{ hideAttribution: true }}
                        >
                            <Background color="#1e1e2e" gap={24} size={1} />
                            <Controls className="!bg-[#1a1a24] !border-white/10 !shadow-lg [&>button]:!bg-[#1a1a24] [&>button]:!border-white/10 [&>button]:!text-white [&>button:hover]:!bg-white/10" />
                            <MiniMap
                                nodeColor={(n) => n.type === 'policyCondition' ? '#8b5cf6' : '#10b981'}
                                maskColor="rgba(0,0,0,0.7)"
                                className="!bg-[#1a1a24] !border-white/10"
                            />
                        </ReactFlow>
                    </div>
                </div>
            </div>

            {/* ── Toast ────────────────────────────────────────────────────────── */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-semibold backdrop-blur-md border
              ${toast.type === 'success'
                                ? 'bg-emerald-500/90 text-white border-emerald-400/30'
                                : 'bg-rose-500/90 text-white border-rose-400/30'
                            }`}
                    >
                        {toast.type === 'success'
                            ? <CheckCircle className="w-5 h-5" />
                            : <AlertCircle className="w-5 h-5" />
                        }
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function DecisionStudio() {
    return (
        <ReactFlowProvider>
            <DecisionStudioInner />
        </ReactFlowProvider>
    );
}
