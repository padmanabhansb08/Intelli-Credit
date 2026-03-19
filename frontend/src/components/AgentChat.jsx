'use client';
import { useState, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Agent Chat Overlay
// ---------------------------------------------------------------------------
export default function AgentChat({
  taskId,
  agent,
  onClose,
  apiUrl = '',
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const baseUrl = apiUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8006/api';

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add welcome message on agent change
  useEffect(() => {
    if (agent) {
      setMessages([
        {
          role: 'agent',
          content: `I am ${agent.label || agent.name}, acting as **${agent.entityType || agent.role}** in this simulation. Ask me anything about my decisions, risk assessments, or observations during the stress test.`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [agent?.label, agent?.name]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const agentId = agent?.id || agent?.agent_id || agent?.entityId || '';
      const res = await fetch(`${baseUrl}/sim/interact-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          agent_id: agentId,
          query: userMessage.content,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          content: data.response || 'No response generated.',
          context: `Used ${data.context_memories_used || 0} memories`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'error',
          content: `Failed to reach agent: ${err.message}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!agent) return null;

  const agentColor =
    {
      applicant: '#3b82f6',
      supplier: '#10b981',
      competitor: '#f97316',
      regulator: '#a855f7',
      customer: '#06b6d4',
      lender: '#f43f5e',
    }[agent.entityType || agent.role] || '#6b7280';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '420px',
        height: '100vh',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        borderLeft: `2px solid ${agentColor}44`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        boxShadow: `-8px 0 32px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${agentColor}, ${agentColor}88)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 700,
              color: 'white',
              border: `2px solid ${agentColor}`,
            }}
          >
            {(agent.label || agent.name || '?')[0]}
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
              {agent.label || agent.name}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: agentColor,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 600,
              }}
            >
              {agent.entityType || agent.role}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#94a3b8',
            padding: '6px 10px',
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => (e.target.style.background = 'rgba(255,255,255,0.1)')}
          onMouseOut={(e) => (e.target.style.background = 'rgba(255,255,255,0.05)')}
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius:
                  msg.role === 'user'
                    ? '14px 14px 4px 14px'
                    : '14px 14px 14px 4px',
                background:
                  msg.role === 'user'
                    ? 'linear-gradient(135deg, #1e40af, #3b82f6)'
                    : msg.role === 'error'
                    ? 'rgba(239,68,68,0.15)'
                    : 'rgba(255,255,255,0.05)',
                border:
                  msg.role === 'error'
                    ? '1px solid rgba(239,68,68,0.3)'
                    : '1px solid rgba(255,255,255,0.06)',
                color: msg.role === 'error' ? '#fca5a5' : '#e2e8f0',
                fontSize: '13px',
                lineHeight: '1.5',
              }}
            >
              {msg.content}
              {msg.context && (
                <div
                  style={{
                    marginTop: '6px',
                    fontSize: '10px',
                    color: '#64748b',
                    fontStyle: 'italic',
                  }}
                >
                  {msg.context}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '14px 14px 14px 4px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#94a3b8',
                fontSize: '13px',
              }}
            >
              <span style={{ animation: 'pulse 1.5s infinite' }}>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          gap: '8px',
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask ${agent.label || agent.name} a question...`}
          disabled={loading}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            padding: '10px 14px',
            color: '#f1f5f9',
            fontSize: '13px',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => (e.target.style.borderColor = agentColor)}
          onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            background: `linear-gradient(135deg, ${agentColor}, ${agentColor}cc)`,
            border: 'none',
            borderRadius: '10px',
            padding: '10px 16px',
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.5 : 1,
            transition: 'all 0.2s',
          }}
        >
          →
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
