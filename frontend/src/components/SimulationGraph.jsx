'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ---------------------------------------------------------------------------
// Color palette for entity types
// ---------------------------------------------------------------------------
const TYPE_COLORS = {
  applicant: { bg: '#1e40af', border: '#3b82f6', glow: 'rgba(59,130,246,0.4)' },
  supplier: { bg: '#065f46', border: '#10b981', glow: 'rgba(16,185,129,0.4)' },
  competitor: { bg: '#9a3412', border: '#f97316', glow: 'rgba(249,115,22,0.4)' },
  regulator: { bg: '#7e22ce', border: '#a855f7', glow: 'rgba(168,85,247,0.4)' },
  customer: { bg: '#0e7490', border: '#06b6d4', glow: 'rgba(6,182,212,0.4)' },
  lender: { bg: '#be123c', border: '#f43f5e', glow: 'rgba(244,63,94,0.4)' },
};

const RELATIONSHIP_COLORS = {
  supplies_to: '#10b981',
  competes_with: '#f97316',
  regulates: '#a855f7',
  lends_to: '#f43f5e',
  buys_from: '#06b6d4',
  depends_on: '#6b7280',
};

// ---------------------------------------------------------------------------
// Custom Node Component
// ---------------------------------------------------------------------------
function EntityNode({ data }) {
  const colors = TYPE_COLORS[data.entityType] || TYPE_COLORS.applicant;
  const isActive = data.isActive;
  const isApplicant = data.entityType === 'applicant';

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${colors.bg}, ${colors.bg}dd)`,
        border: `2px solid ${colors.border}`,
        borderRadius: isApplicant ? '16px' : '12px',
        padding: isApplicant ? '16px 20px' : '10px 14px',
        color: 'white',
        minWidth: isApplicant ? '180px' : '140px',
        textAlign: 'center',
        boxShadow: isActive
          ? `0 0 20px ${colors.glow}, 0 0 40px ${colors.glow}`
          : `0 4px 12px rgba(0,0,0,0.3)`,
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        transform: isActive ? 'scale(1.05)' : 'scale(1)',
      }}
      onClick={() => data.onNodeClick?.(data)}
    >
      <div style={{
        fontSize: isApplicant ? '14px' : '12px',
        fontWeight: 700,
        marginBottom: '4px',
        letterSpacing: '0.02em',
      }}>
        {data.label}
      </div>
      <div style={{
        fontSize: '10px',
        opacity: 0.8,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        {data.entityType}
      </div>
      {data.resilience !== undefined && data.resilience !== null && (
        <div style={{
          marginTop: '6px',
          fontSize: '11px',
          fontWeight: 600,
          color: data.resilience > 60 ? '#4ade80' : data.resilience > 30 ? '#fbbf24' : '#f87171',
        }}>
          ⚡ {data.resilience.toFixed(0)}%
        </div>
      )}
    </div>
  );
}

const nodeTypes = { entity: EntityNode };

// ---------------------------------------------------------------------------
// Main SimulationGraph Component
// ---------------------------------------------------------------------------
export default function SimulationGraph({
  taskId,
  apiUrl = '',
  onNodeClick,
  onSimulationComplete,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [status, setStatus] = useState('idle'); // idle, connecting, running, completed, failed
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(20);
  const [resilience, setResilience] = useState(50);
  const [activeAgentId, setActiveAgentId] = useState(null);
  const [interactionLog, setInteractionLog] = useState([]);

  const baseUrl = apiUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8006/api';

  // --- SSE Connection ---
  useEffect(() => {
    if (!taskId) return;

    setStatus('connecting');
    const eventSource = new EventSource(`${baseUrl}/sim/stream/${taskId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.event === 'interaction') {
          // Add new interaction to log
          setInteractionLog((prev) => [...prev, data]);

          // Highlight the speaking agent
          setActiveAgentId(data.speaker_id);

          // Create/update node for this agent
          setNodes((prev) => {
            const existing = prev.find(
              (n) => n.id === data.speaker_id
            );
            if (existing) {
              return prev.map((n) =>
                n.id === data.speaker_id
                  ? {
                      ...n,
                      data: {
                        ...n.data,
                        isActive: true,
                        resilience: data.impact?.resilience_delta
                          ? (n.data.resilience || 50) + data.impact.resilience_delta
                          : n.data.resilience,
                        lastMessage: data.message,
                      },
                    }
                  : { ...n, data: { ...n.data, isActive: false } }
              );
            } else {
              // New agent — add node in a circular layout
              const angle = (prev.length * (2 * Math.PI)) / 8;
              const radius = prev.length === 0 ? 0 : 200;
              return [
                ...prev.map((n) => ({ ...n, data: { ...n.data, isActive: false } })),
                {
                  id: data.speaker_id,
                  type: 'entity',
                  position: {
                    x: 400 + radius * Math.cos(angle),
                    y: 300 + radius * Math.sin(angle),
                  },
                  data: {
                    label: data.speaker,
                    entityType: data.type === 'reaction' ? 'applicant' : 'supplier',
                    isActive: true,
                    resilience: null,
                    onNodeClick: (nodeData) => onNodeClick?.(nodeData),
                  },
                },
              ];
            }
          });

          // Reset active highlight after a delay
          setTimeout(() => setActiveAgentId(null), 2000);
          setStatus('running');
        }

        if (data.event === 'state_update') {
          setCurrentRound(data.round || 0);
          setTotalRounds(data.total_rounds || 20);
          setResilience(data.resilience || 50);
        }

        if (data.event === 'simulation_complete') {
          setStatus(data.status === 'completed' ? 'completed' : 'failed');
          onSimulationComplete?.(data);
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    eventSource.onerror = () => {
      setStatus('failed');
      eventSource.close();
    };

    return () => eventSource.close();
  }, [taskId, baseUrl]);

  // --- Status indicator ---
  const statusColor =
    status === 'running'
      ? '#10b981'
      : status === 'completed'
      ? '#3b82f6'
      : status === 'failed'
      ? '#ef4444'
      : '#6b7280';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Status Bar */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 10,
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          background: 'rgba(15,23,42,0.9)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px',
          padding: '8px 14px',
          fontSize: '12px',
          color: '#e2e8f0',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor,
            boxShadow: `0 0 8px ${statusColor}`,
            animation: status === 'running' ? 'pulse 1.5s infinite' : 'none',
          }}
        />
        <span style={{ fontWeight: 600 }}>{status.toUpperCase()}</span>
        {status === 'running' && (
          <>
            <span style={{ opacity: 0.5 }}>|</span>
            <span>Round {currentRound}/{totalRounds}</span>
            <span style={{ opacity: 0.5 }}>|</span>
            <span style={{
              color: resilience > 60 ? '#4ade80' : resilience > 30 ? '#fbbf24' : '#f87171',
              fontWeight: 600,
            }}>
              ⚡ {resilience.toFixed(0)}%
            </span>
          </>
        )}
      </div>

      {/* Graph */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        style={{ background: '#0f172a' }}
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: '#475569', strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
        }}
      >
        <Background color="#1e293b" gap={20} size={1} />
        <Controls
          style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
        />
        <MiniMap
          nodeColor={(n) => TYPE_COLORS[n.data?.entityType]?.border || '#475569'}
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 8,
          }}
        />
      </ReactFlow>

      {/* Interaction Feed (bottom overlay) */}
      {interactionLog.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            right: 12,
            maxHeight: '120px',
            overflowY: 'auto',
            zIndex: 10,
            background: 'rgba(15,23,42,0.9)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            padding: '8px 12px',
            fontSize: '11px',
            color: '#94a3b8',
          }}
        >
          {interactionLog.slice(-5).map((item, idx) => (
            <div key={idx} style={{ marginBottom: 4 }}>
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                [R{item.round}] {item.speaker}:
              </span>{' '}
              {item.message?.slice(0, 120)}...
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
