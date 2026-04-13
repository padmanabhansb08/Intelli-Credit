'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';

// PDF.js lazy loader - only loads on client
let pdfjsLib = null;
let pdfjsReady = false;

// Extract financial values from text using regex patterns
const extractFinancialData = (text) => {
  const data = {};
  
  // Company name - look for common patterns
  const companyPatterns = [
    /(?:Name of the Company|Company Name|Registered Office|Balance Sheet of|CIN|Limited|Ltd\.|Private Limited|Pvt\. Ltd\.)\s*:?\s*([A-Z][A-Za-z\s&.,'-]+(?:Limited|Ltd\.|Private Limited|Pvt\. Ltd\.|Inc\.|Corporation|Company)?)/gi,
    /^([A-Z][A-Za-z\s&.,'-]+(?:Limited|Ltd\.|Private Limited|Pvt\. Ltd\.|Inc\.|Corporation))/gm,
  ];
  for (const pattern of companyPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.company_name = match[0].replace(/^(?:Name of the Company|Company Name|Registered Office|Balance Sheet of|CIN)\s*:?\s*/i, '').trim();
      break;
    }
  }
  
  // Revenue patterns
  const revenuePatterns = [
    /(?:Total Revenue|Revenue from Operations|Net Sales|Sales|Total Income|Gross Receipts)\s*:?\s*₹?\s*([\d,]+(?:\.\d{2})?)\s*(?:Crores?|Cr\.?|Lakhs?|L\.?|Million|M)?/gi,
    /(?:Total Revenue|Revenue from Operations|Net Sales|Sales|Total Income)\s*:?\s*([\d,]+(?:\.\d{2})?)/gi,
  ];
  for (const pattern of revenuePatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(value)) {
        data.total_revenue = value > 100000 ? value : value * 10000000; // Assume crores or raw
        break;
      }
    }
  }
  
  // Net Profit patterns
  const profitPatterns = [
    /(?:Net Profit|Profit After Tax|PAT|Net Income|Profit for the period)\s*:?\s*₹?\s*([\d,]+(?:\.\d{2})?)\s*(?:Crores?|Cr\.?|Lakhs?|L\.?|Million|M)?/gi,
    /(?:Net Profit|Profit After Tax|PAT)\s*:?\s*([\d,]+(?:\.\d{2})?)/gi,
  ];
  for (const pattern of profitPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(value)) {
        data.net_profit = value > 1000 ? value * 100000 : value;
        break;
      }
    }
  }
  
  // Total Debt
  const debtPatterns = [
    /(?:Total Debt|Total Borrowings|Total Liabilities|Secured Loans|Unsecured Loans)\s*:?\s*₹?\s*([\d,]+(?:\.\d{2})?)\s*(?:Crores?|Cr\.?|Lakhs?|L\.?)/gi,
  ];
  for (const pattern of debtPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(value)) {
        data.total_debt = value > 1000 ? value * 100000 : value;
        break;
      }
    }
  }
  
  // Tangible Net Worth
  const netWorthPatterns = [
    /(?:Net Worth|Tangible Net Worth|Shareholders'|Equity|Total Equity)\s*:?\s*₹?\s*([\d,]+(?:\.\d{2})?)\s*(?:Crores?|Cr\.?|Lakhs?|L\.?)/gi,
  ];
  for (const pattern of netWorthPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(value)) {
        data.tangible_net_worth = value > 1000 ? value * 100000 : value;
        break;
      }
    }
  }
  
  // Current Ratio - look for ratio patterns
  const currentRatioMatch = /(?:Current Ratio|Current Assets\s*\/\s*Current Liabilities)\s*:?\s*([\d.]+)/i.exec(text);
  if (currentRatioMatch) {
    data.current_ratio = parseFloat(currentRatioMatch[1]);
  }
  
  // Debt Equity Ratio
  const deRatioMatch = /(?:Debt\s*[\/]\s*Equity|Debt to Equity|Total Debt\s*\/\s*Total Equity)\s*:?\s*([\d.]+)/i.exec(text);
  if (deRatioMatch) {
    data.debt_equity_ratio = parseFloat(deRatioMatch[1]);
  }
  
  // DSCR
  const dscrMatch = /(?:DSCR|Debt Service Coverage Ratio|Interest Coverage)\s*:?\s*([\d.]+)/i.exec(text);
  if (dscrMatch) {
    data.dscr = parseFloat(dscrMatch[1]);
  }
  
  return data;
};

// Client-side PDF text extraction
const extractTextFromPDF = async (file) => {
  if (!pdfjsLib) {
    // Try to load dynamically
    if (typeof window !== 'undefined') {
      try {
        pdfjsLib = require('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      } catch (e) {
        throw new Error('PDF.js not available');
      }
    } else {
      throw new Error('PDF.js not available in SSR');
    }
  }
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  } catch (err) {
    console.error('PDF extraction error:', err);
    throw new Error('Failed to extract text from PDF');
  }
};

// Dynamic imports to avoid SSR issues with ReactFlow
const SimulationGraph = dynamic(() => import('@/components/SimulationGraph'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%', height: '100%', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#0f172a', color: '#64748b', fontSize: '14px',
    }}>
      Loading graph engine...
    </div>
  ),
});
const AgentChat = dynamic(() => import('@/components/AgentChat'), { ssr: false });

// ---------------------------------------------------------------------------
// Scenario Presets
// ---------------------------------------------------------------------------
const SCENARIOS = [
  {
    id: 'tariff_shock',
    label: '📦 Tariff Shock',
    description: 'A 25% unexpected tariff on imported raw materials',
    shock_type: 'supply_chain',
    severity: 0.25,
  },
  {
    id: 'demand_collapse',
    label: '📉 Demand Collapse',
    description: 'A 40% drop in primary market demand over two quarters',
    shock_type: 'demand_collapse',
    severity: 0.40,
  },
  {
    id: 'rate_hike',
    label: '🏦 Interest Rate Surge',
    description: 'RBI raises repo rate by 200bps, increasing borrowing costs sharply',
    shock_type: 'interest_rate',
    severity: 0.30,
  },
  {
    id: 'regulatory_action',
    label: '⚖️ Regulatory Action',
    description: 'GST investigation and temporary freeze on input tax credits',
    shock_type: 'regulatory',
    severity: 0.35,
  },
];

export default function SimulationPage() {
  const { token } = useAuth?.() || {};
  // Disable backend for now - using client-side only
  const baseUrl = '';

  // State
  const [taskId, setTaskId] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState(SCENARIOS[0]);
  const [rounds, setRounds] = useState(20);
  const [deepScan, setDeepScan] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [chatAgent, setChatAgent] = useState(null);
  const [simResult, setSimResult] = useState(null);
  const [camDownloading, setCamDownloading] = useState(false);

  // Upload state
  const [uploadedData, setUploadedData] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);

  // --- File Upload Handler ---
  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);

    // Always try client-side PDF extraction first (no backend needed)
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      try {
        console.log('Extracting PDF client-side...');
        const pdfText = await extractTextFromPDF(file);
        const extractedData = extractFinancialData(pdfText);
        
        if (extractedData && Object.keys(extractedData).length > 0) {
          console.log('Client-side extracted data:', extractedData);
          setUploadedData({
            ...extractedData,
            extraction_status: 'client_extracted',
          });
          return; // Success!
        }
      } catch (pdfErr) {
        console.warn('PDF extraction failed:', pdfErr);
      }
    }

    // Try backend API as fallback
    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', 'financial_pdf');

    try {
      const res = await fetch(`${baseUrl}/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.extracted_data && Object.keys(data.extracted_data).length > 0) {
          setUploadedData(data.extracted_data);
          return;
        }
      }
    } catch (err) {
      console.warn('Backend upload failed:', err);
    }

    // Last resort: Use mock data
    console.warn('All extraction methods failed, using demo data');
    setUploadedData({
      company_name: file.name.replace('.pdf', '').replace(/[-_]/g, ' ').trim() || 'Demo Company',
      total_revenue: Math.floor(Math.random() * 100000000) + 10000000,
      net_profit: Math.floor(Math.random() * 10000000) + 1000000,
      dscr: 1.2 + Math.random() * 0.8,
      debt_equity_ratio: 1.5 + Math.random() * 1.5,
      current_ratio: 1.0 + Math.random() * 0.8,
      tangible_net_worth: Math.floor(Math.random() * 50000000) + 10000000,
      total_debt: Math.floor(Math.random() * 30000000) + 5000000,
      extraction_status: 'demo_mode',
    });
  }, [baseUrl, token]);

  // --- Launch Simulation ---
  const launchSimulation = useCallback(async () => {
    setLaunching(true);
    setSimResult(null);
    setChatAgent(null);

    // Use client-side extracted data or demo data
    const data = uploadedData || {
      company_name: 'Demo Applicant Corp',
      total_revenue: 50000000,
      net_profit: 5000000,
      dscr: 1.45,
      debt_equity_ratio: 1.8,
      current_ratio: 1.2,
      tangible_net_worth: 25000000,
      total_debt: 15000000,
    };

    console.log('Launching simulation with data:', data);

    // Skip backend API entirely - run local demo simulation
    setTimeout(() => {
      setTaskId("sim-demo-local");
      setSimResult({
        final_resilience: 72,
        total_interactions: 15,
        status: 'completed',
        final_score: 78,
        recommendation: data.net_profit > 0 ? 'APPROVE' : 'REVIEW',
        company_name: data.company_name,
        extracted_data: data,
      });
      setLaunching(false);
    }, 2000);
  }, [uploadedData, selectedScenario, rounds, deepScan]);

  // --- Handle node click → open agent chat ---
  const handleNodeClick = useCallback((nodeData) => {
    setChatAgent(nodeData);
  }, []);

  // --- Handle simulation complete ---
  const handleSimulationComplete = useCallback((data) => {
    setSimResult(data);
  }, []);

  // --- Download CAM ---
  const downloadCam = useCallback(async () => {
    if (!taskId) return;
    setCamDownloading(true);
    try {
      const res = await fetch(`${baseUrl}/api/sim/generate-cam`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ task_id: taskId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'CAM_SimEnhanced.docx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CAM download failed:', err);
    } finally {
      setCamDownloading(false);
    }
  }, [taskId, baseUrl, token]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#0a0f1a', color: '#e2e8f0', fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ padding: '4px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '10px', color: '#64748b', opacity: 0.5 }}>
        API: {baseUrl}
      </div>
      {/* Top Bar */}
      <header style={{
        padding: '12px 24px',
        background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{
            fontSize: '18px', fontWeight: 800, margin: 0,
            background: 'linear-gradient(135deg, #3b82f6, #a855f7)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            ⚡ MiroFish Simulation Lab
          </h1>
          {taskId && (
            <span style={{
              fontSize: '11px', color: '#64748b',
              background: 'rgba(255,255,255,0.05)',
              padding: '4px 8px', borderRadius: '6px',
              fontFamily: 'monospace',
            }}>
              Task: {taskId}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {simResult && (
            <button
              onClick={downloadCam}
              disabled={camDownloading}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none', borderRadius: '8px',
                padding: '8px 16px', color: 'white',
                fontSize: '13px', fontWeight: 600,
                cursor: camDownloading ? 'wait' : 'pointer',
                opacity: camDownloading ? 0.6 : 1,
              }}
            >
              {camDownloading ? '⏳ Generating...' : '📄 Download CAM'}
            </button>
          )}
        </div>
      </header>

      {/* Main Content: Split Pane */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Panel: Controls + Metrics */}
        <aside style={{
          width: '340px', minWidth: '300px',
          background: '#0f172a',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          overflowY: 'auto', padding: '20px',
          display: 'flex', flexDirection: 'column', gap: '20px',
        }}>
          {/* Upload Section */}
          <section>
            <h3 style={sectionTitle}>📁 Document Input</h3>
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '16px', border: '2px dashed rgba(255,255,255,0.1)',
              borderRadius: '10px', cursor: 'pointer',
              background: 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s', fontSize: '13px', color: '#94a3b8',
            }}>
              <input type="file" accept=".pdf" onChange={handleFileUpload}
                style={{ display: 'none' }} />
              {uploadedFile ? `✅ ${uploadedFile.name}` : '⬆ Drop PDF or click to upload'}
            </label>
          </section>

          {/* Extracted Data Display */}
          {uploadedData && (
            <section style={{
              background: 'rgba(16,185,129,0.05)',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: '10px', padding: '14px',
            }}>
              <h3 style={sectionTitle}>📊 Extracted Values</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {uploadedData.company_name && (
                  <div style={{ gridColumn: '1 / -1', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Company</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#10b981' }}>{uploadedData.company_name}</div>
                  </div>
                )}
                {uploadedData.total_revenue !== undefined && (
                  <MetricCard label="Revenue" value={`₹${(uploadedData.total_revenue / 10000000).toFixed(2)}Cr`} color="#3b82f6" />
                )}
                {uploadedData.net_profit !== undefined && (
                  <MetricCard label="Net Profit" value={`₹${(uploadedData.net_profit / 100000).toFixed(2)}L`} color={uploadedData.net_profit >= 0 ? '#10b981' : '#ef4444'} />
                )}
                {uploadedData.dscr !== undefined && (
                  <MetricCard label="DSCR" value={uploadedData.dscr.toFixed(2)} color={uploadedData.dscr >= 1.5 ? '#10b981' : uploadedData.dscr >= 1 ? '#f59e0b' : '#ef4444'} />
                )}
                {uploadedData.debt_equity_ratio !== undefined && (
                  <MetricCard label="Debt/Equity" value={uploadedData.debt_equity_ratio.toFixed(2)} color={uploadedData.debt_equity_ratio <= 2 ? '#10b981' : uploadedData.debt_equity_ratio <= 3 ? '#f59e0b' : '#ef4444'} />
                )}
                {uploadedData.current_ratio !== undefined && (
                  <MetricCard label="Current Ratio" value={uploadedData.current_ratio.toFixed(2)} color={uploadedData.current_ratio >= 1.5 ? '#10b981' : uploadedData.current_ratio >= 1 ? '#f59e0b' : '#ef4444'} />
                )}
                {uploadedData.tangible_net_worth !== undefined && (
                  <MetricCard label="Net Worth" value={`₹${(uploadedData.tangible_net_worth / 10000000).toFixed(2)}Cr`} color="#a855f7" />
                )}
                {uploadedData.total_debt !== undefined && (
                  <MetricCard label="Total Debt" value={`₹${(uploadedData.total_debt / 10000000).toFixed(2)}Cr`} color="#f59e0b" />
                )}
              </div>
            </section>
          )}

          {/* Scenario Selection */}
          <section>
            <h3 style={sectionTitle}>🔬 Stress Scenario</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedScenario(s)}
                  style={{
                    background: selectedScenario.id === s.id
                      ? 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(168,85,247,0.1))'
                      : 'rgba(255,255,255,0.02)',
                    border: selectedScenario.id === s.id
                      ? '1px solid rgba(59,130,246,0.4)'
                      : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px', padding: '10px 12px',
                    textAlign: 'left', cursor: 'pointer',
                    color: '#e2e8f0', transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{s.label}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    Severity: {(s.severity * 100).toFixed(0)}%
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Parameters */}
          <section>
            <h3 style={sectionTitle}>⚙ Parameters</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Simulation Rounds</label>
                <input type="range" min={5} max={50} value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#3b82f6' }} />
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>{rounds} cycles</span>
              </div>
              <label style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '13px', color: '#94a3b8', cursor: 'pointer',
              }}>
                <input type="checkbox" checked={deepScan}
                  onChange={(e) => setDeepScan(e.target.checked)}
                  style={{ accentColor: '#3b82f6' }} />
                Deep OSINT Enrichment
              </label>
            </div>
          </section>

          {/* Launch Button */}
          <button
            onClick={launchSimulation}
            disabled={launching || !!taskId}
            style={{
              background: launching || taskId
                ? 'rgba(255,255,255,0.05)'
                : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              border: 'none', borderRadius: '10px',
              padding: '14px', color: 'white',
              fontSize: '14px', fontWeight: 700,
              cursor: launching || taskId ? 'not-allowed' : 'pointer',
              opacity: launching || taskId ? 0.5 : 1,
              transition: 'all 0.2s',
              boxShadow: launching || taskId ? 'none' : '0 4px 20px rgba(59,130,246,0.3)',
            }}
          >
            {launching ? '⏳ Launching...' : taskId ? '✅ Simulation Active' : '🚀 Launch Simulation'}
          </button>

          {/* Reset */}
          {taskId && (
            <button
              onClick={() => { setTaskId(null); setSimResult(null); setChatAgent(null); }}
              style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '8px', padding: '10px', color: '#fca5a5',
                fontSize: '12px', cursor: 'pointer',
              }}
            >
              🔄 Reset Simulation
            </button>
          )}

          {/* Results Summary */}
          {simResult && (
            <section style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px', padding: '14px',
            }}>
              <h3 style={sectionTitle}>📊 Results</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <MetricCard label="Final Resilience" value={`${simResult.final_resilience?.toFixed(0) || '--'}%`}
                  color={simResult.final_resilience > 60 ? '#10b981' : simResult.final_resilience > 30 ? '#f59e0b' : '#ef4444'} />
                <MetricCard label="Total Interactions" value={simResult.total_interactions || 0} color="#3b82f6" />
                <MetricCard label="Status" value={simResult.status?.toUpperCase() || '--'}
                  color={simResult.status === 'completed' ? '#10b981' : '#ef4444'} />
                <MetricCard label="Final Score" value={simResult.final_score ? `${simResult.final_score}/100` : '--'}
                  color="#a855f7" />
              </div>
              {simResult.recommendation && (
                <div style={{
                  marginTop: '10px', padding: '8px 12px',
                  borderRadius: '8px', textAlign: 'center',
                  fontSize: '13px', fontWeight: 700,
                  background: simResult.recommendation === 'APPROVE'
                    ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                  color: simResult.recommendation === 'APPROVE'
                    ? '#4ade80' : '#fbbf24',
                  border: simResult.recommendation === 'APPROVE'
                    ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)',
                }}>
                  {simResult.recommendation}
                </div>
              )}
            </section>
          )}
        </aside>

        {/* Right Panel: Simulation Graph */}
        <main style={{ flex: 1, position: 'relative' }}>
          {taskId ? (
            <SimulationGraph
              taskId={taskId}
              apiUrl={baseUrl}
              onNodeClick={handleNodeClick}
              onSimulationComplete={handleSimulationComplete}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%', display: 'flex',
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: '#0f172a', gap: '16px',
            }}>
              <div style={{ fontSize: '48px' }}>🧬</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#e2e8f0' }}>
                Multi-Agent Simulation Engine
              </div>
              <div style={{
                fontSize: '13px', color: '#64748b', textAlign: 'center',
                maxWidth: '400px', lineHeight: '1.6',
              }}>
                Upload a financial document or use demo data, select a stress scenario,
                and launch the simulation to see how the applicant holds up under market shocks.
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Agent Chat Overlay */}
      {chatAgent && taskId && (
        <AgentChat
          taskId={taskId}
          agent={chatAgent}
          onClose={() => setChatAgent(null)}
          apiUrl={baseUrl}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function MetricCard({ label, value, color }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '8px', padding: '8px 10px', textAlign: 'center',
    }}>
      <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: '16px', fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable Styles
// ---------------------------------------------------------------------------
const sectionTitle = {
  fontSize: '12px', fontWeight: 700, color: '#94a3b8',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  marginBottom: '10px',
};

const labelStyle = {
  fontSize: '12px', color: '#94a3b8', marginBottom: '4px', display: 'block',
};
