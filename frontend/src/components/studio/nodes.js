import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileText,
  Play,
  RefreshCw,
  Share2,
} from 'lucide-react';

const runtimeTone = {
  idle: {
    badge: 'bg-[#111111] text-gray-500',
    ring: 'border-gray-800',
  },
  running: {
    badge: 'bg-white/10 text-white',
    ring: 'border-white/50 shadow-white/10',
  },
  retrying: {
    badge: 'bg-gray-800 text-gray-300',
    ring: 'border-gray-600 shadow-gray-800/10',
  },
  success: {
    badge: 'bg-gray-900 text-white border border-gray-700',
    ring: 'border-gray-500 shadow-gray-900/10',
  },
  failed: {
    badge: 'bg-[#1a1a1a] text-gray-400 border border-gray-700',
    ring: 'border-gray-700 shadow-[#1a1a1a]/10',
  },
  skipped: {
    badge: 'bg-black text-gray-600',
    ring: 'border-gray-800/50',
  },
};

const getRuntime = (data) => data.runtime || { status: 'idle' };

const CustomHandle = ({ type, position, colorClass, id, style }) => (
  <Handle
    type={type}
    position={position}
    id={id}
    style={style}
    className={`w-3 h-3 ${colorClass} border-2 border-[#1A1A1A] transition-all hover:scale-125 z-50`}
  />
);

const RuntimeBadge = ({ data }) => {
  const runtime = getRuntime(data);
  const tone = runtimeTone[runtime.status] || runtimeTone.idle;

  return (
    <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${tone.badge}`}>
      {runtime.status}
    </div>
  );
};

const ErrorHandle = () => (
  <CustomHandle
    type="source"
    position={Position.Right}
    id="error"
    colorClass="bg-gray-600"
    style={{ top: '50%' }}
  />
);

export const TriggerNode = memo(({ data, selected }) => {
  const runtime = getRuntime(data);
  const tone = runtimeTone[runtime.status] || runtimeTone.idle;

  return (
    <div className={`relative flex flex-col items-center bg-[#1A1A1A] p-5 rounded-xl shadow-lg border border-gray-800 ${selected ? 'shadow-xl ring-1 ring-white/20' : ''} ${tone.ring} transition-all`}>
      <RuntimeBadge data={data} />
      <div className="w-12 h-12 rounded-full bg-[#111111] border border-gray-700 flex items-center justify-center text-white mb-3">
        <Play className="w-5 h-5 ml-1" />
      </div>
      <span className="text-sm font-semibold text-white">{data.label}</span>
      <span className="text-[10px] text-gray-500 mt-1 font-bold tracking-wider uppercase">Initiation</span>
      <CustomHandle type="source" position={Position.Bottom} colorClass="bg-white" />
    </div>
  );
});

export const DocumentClassificationNode = memo(({ data, selected }) => {
  const runtime = getRuntime(data);
  const tone = runtimeTone[runtime.status] || runtimeTone.idle;

  return (
    <div className={`relative w-80 bg-[#1A1A1A] rounded-xl shadow-md border border-gray-800 ${selected ? 'shadow-lg ring-1 ring-white/20' : ''} ${tone.ring} p-0 overflow-hidden text-left transition-all group`}>
      <RuntimeBadge data={data} />
      <div className="bg-[#111111] border-b border-gray-800 p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center text-white shrink-0">
          <FileText className="w-4 h-4" />
        </div>
        <div className="flex flex-col text-white flex-1 pr-20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">IDP Extraction</span>
          <span className="text-sm font-semibold text-white">{data.label || 'Document Classifier'}</span>
        </div>
        {data.confidence && (
          <div className="bg-gray-900 border border-gray-700 px-2 py-1 rounded-md flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-white" />
            <span className="text-[10px] font-bold text-white">{data.confidence}%</span>
          </div>
        )}
      </div>

      {data.error && (
        <div className="bg-[#111111] border-b border-gray-800 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-semibold">{data.error}</p>
            <button className="mt-2 text-xs bg-[#1A1A1A] border border-gray-700 text-white px-3 py-1.5 rounded-md font-semibold flex items-center gap-1 hover:bg-gray-800 transition-colors shadow-sm">
              <RefreshCw className="w-3 h-3" /> Re-upload Document
            </button>
          </div>
        </div>
      )}

      {!data.error && data.extractedFields && (
        <div className="p-3 bg-[#111111] border-b border-gray-800">
          <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-2 block">Extracted Entities</span>
          <div className="bg-[#1A1A1A] rounded-md border border-gray-800 overflow-hidden shadow-sm">
            {data.extractedFields.map((field, idx) => (
              <div key={idx} className={`flex justify-between p-1.5 px-3 text-xs ${idx !== data.extractedFields.length - 1 ? 'border-b border-gray-800' : ''}`}>
                <span className="text-gray-400 font-medium">{field.key}</span>
                <span className="text-white font-semibold font-mono">{field.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-2.5 bg-[#1A1A1A] flex justify-between items-center px-4">
        <span className="text-[10px] text-gray-500 font-medium">Model: <span className="text-gray-300 font-semibold">SciBERT+Flan-T5</span></span>
        {runtime.durationMs != null && <span className="text-[10px] text-gray-500">{runtime.durationMs} ms</span>}
      </div>

      <CustomHandle type="target" position={Position.Top} colorClass="bg-gray-400" />
      <CustomHandle type="source" position={Position.Bottom} colorClass="bg-white" />
      <ErrorHandle />
    </div>
  );
});

export const IntegrationNode = memo(({ data, selected }) => {
  const runtime = getRuntime(data);
  const tone = runtimeTone[runtime.status] || runtimeTone.idle;

  return (
    <div className={`relative w-72 bg-[#1A1A1A] rounded-xl shadow-md border border-gray-800 ${selected ? 'ring-1 ring-white/20 shadow-lg' : ''} ${tone.ring} flex items-stretch overflow-hidden transition-all text-left`}>
      <RuntimeBadge data={data} />
      <div className="w-1.5 bg-gray-500 shrink-0"></div>

      <div className="p-3 flex-1 flex flex-col gap-2 pr-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#111111] border border-gray-700 flex items-center justify-center text-white shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">{data.connection || 'API Gateway'}</span>
            <span className="text-sm font-semibold text-white truncate">{data.label}</span>
          </div>
        </div>

        {data.warning && (
          <div className="mt-2 bg-[#111111] border border-gray-800 rounded-md p-2 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <span className="text-xs text-gray-300 font-medium">{data.warningDetails || 'High latency detected down-stream.'}</span>
          </div>
        )}

        {runtime.error && (
          <div className="bg-[#111111] border border-gray-800 rounded-md p-2 text-xs text-gray-400 font-medium">
            {runtime.error}
          </div>
        )}
      </div>

      <CustomHandle type="target" position={Position.Top} colorClass="bg-gray-600" />
      <CustomHandle type="source" position={Position.Bottom} colorClass="bg-gray-400" />
      <ErrorHandle />
    </div>
  );
});

export const ConditionNode = memo(({ data, selected }) => {
  const runtime = getRuntime(data);
  const tone = runtimeTone[runtime.status] || runtimeTone.idle;

  return (
    <div className={`relative w-64 bg-[#1A1A1A] rounded-xl shadow-md border border-gray-800 ${selected ? 'shadow-lg ring-1 ring-white/20' : ''} ${tone.ring} p-4 flex flex-col transition-all text-left`}>
      <RuntimeBadge data={data} />
      <div className="flex items-center gap-3 mb-3 pr-20">
        <div className="w-10 h-10 rounded-lg bg-[#111111] border border-gray-700 flex items-center justify-center text-white shrink-0">
          <Share2 className="w-5 h-5 opacity-70" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Routing Logic</span>
          <span className="text-sm font-semibold text-white truncate">{data.label}</span>
        </div>
      </div>

      <div className="bg-[#111111] rounded-lg p-2.5 border border-gray-800">
        <span className="text-xs text-gray-400 font-mono break-all line-clamp-2">{data.expression || data.assignmentDetails}</span>
      </div>

      {runtime.output?.branch && (
        <div className="mt-3 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
          Branch Evaluated: <span className="text-white">{runtime.output.branch}</span>
        </div>
      )}

      <CustomHandle type="target" position={Position.Top} colorClass="bg-gray-500" />
      <CustomHandle type="source" position={Position.Bottom} id="true" colorClass="bg-white" style={{ left: '33%' }} />
      <CustomHandle type="source" position={Position.Bottom} id="false" colorClass="bg-gray-600" style={{ left: '67%' }} />

      <div className="absolute -bottom-6 w-full flex justify-between px-8 text-[9px] font-bold uppercase tracking-wider opacity-60">
        <span className="text-white">TRUE</span>
        <span className="text-gray-400">FALSE</span>
      </div>
    </div>
  );
});

export const ExplainableAINode = memo(({ data, selected }) => {
  const runtime = getRuntime(data);
  const tone = runtimeTone[runtime.status] || runtimeTone.idle;

  return (
    <div className={`relative w-80 bg-[#1A1A1A] rounded-xl shadow-md border border-gray-800 ${selected ? 'shadow-lg ring-1 ring-white/20' : ''} ${tone.ring} p-0 overflow-hidden text-left transition-all`}>
      <RuntimeBadge data={data} />
      <div className="bg-[#111111] border-b border-gray-800 p-3 flex items-center gap-3 pr-20">
        <div className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center text-white shrink-0">
          <Share2 className="w-4 h-4" />
        </div>
        <div className="flex flex-col text-white min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Interpretability</span>
          <span className="text-sm font-semibold truncate">{data.label || 'TreeSHAP Explainer'}</span>
        </div>
      </div>

      <div className="p-4 bg-[#111111]">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Feature Impact</span>
        </div>

        {data.shapValues && (
          <div className="flex flex-col gap-2">
            {data.shapValues.map((feature, idx) => (
              <div key={idx} className="flex flex-col">
                <div className="flex justify-between text-[10px] font-semibold mb-1">
                  <span className="text-gray-400">{feature.name}</span>
                  <span className={feature.impact > 0 ? 'text-gray-400' : 'text-white'}>
                    {feature.impact > 0 ? '+' : ''}{feature.impact.toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden flex border border-gray-800">
                  <div
                    className={`h-full ${feature.impact > 0 ? 'bg-gray-400' : 'bg-white'}`}
                    style={{
                      width: `${Math.min(Math.abs(feature.impact) * 20, 100)}%`,
                      marginLeft: feature.impact > 0 ? '50%' : `${50 - Math.min(Math.abs(feature.impact) * 20, 50)}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-2.5 border-t border-gray-800 bg-[#1A1A1A] flex justify-between items-center px-4">
        <span className="text-[10px] text-gray-500 font-medium">Model: <span className="text-gray-300 font-semibold">XGBoost</span></span>
        {runtime.output?.summary && <span className="text-[10px] text-gray-500 truncate max-w-40">{runtime.output.summary}</span>}
      </div>

      <CustomHandle type="target" position={Position.Top} colorClass="bg-gray-500" />
      <CustomHandle type="source" position={Position.Bottom} colorClass="bg-white" />
      <ErrorHandle />
    </div>
  );
});

export const MCAFilingSyncNode = memo(({ data, selected }) => {
  const runtime = getRuntime(data);
  const tone = runtimeTone[runtime.status] || runtimeTone.idle;

  return (
    <div className={`relative w-72 bg-[#1A1A1A] rounded-xl shadow-md border border-gray-800 ${selected ? 'ring-1 ring-white/20 shadow-lg' : ''} ${tone.ring} flex items-stretch overflow-hidden transition-all text-left`}>
      <RuntimeBadge data={data} />
      <div className="w-1.5 bg-gray-400 shrink-0"></div>

      <div className="p-3 flex-1 flex flex-col gap-2 pr-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#111111] border border-gray-700 flex items-center justify-center text-white shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">Regulator Sync</span>
            <span className="text-sm font-semibold text-white truncate">{data.label || 'MCA V3 Gateway'}</span>
          </div>
        </div>

        {data.cinTarget && (
          <div className="mt-2 bg-[#111111] border border-gray-800 rounded-md p-2 text-xs font-mono text-gray-400 truncate">
            Target CIN: {data.cinTarget}
          </div>
        )}
      </div>

      <CustomHandle type="target" position={Position.Top} colorClass="bg-gray-600" />
      <CustomHandle type="source" position={Position.Bottom} colorClass="bg-gray-400" />
      <ErrorHandle />
    </div>
  );
});

export const EPFOAnomalyNode = memo(({ data, selected }) => {
  const runtime = getRuntime(data);
  const tone = runtimeTone[runtime.status] || runtimeTone.idle;

  return (
    <div className={`relative w-72 bg-[#1A1A1A] rounded-xl shadow-md border border-gray-800 ${selected ? 'ring-1 ring-white/20 shadow-lg' : ''} ${tone.ring} flex items-stretch overflow-hidden transition-all text-left`}>
      <RuntimeBadge data={data} />
      <div className="w-1.5 bg-gray-500 shrink-0"></div>

      <div className="p-3 flex-1 flex flex-col gap-2 pr-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#111111] border border-gray-700 flex items-center justify-center text-white shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">Compliance Check</span>
            <span className="text-sm font-semibold text-white truncate">{data.label || 'EPFO Anomalies'}</span>
          </div>
        </div>

        {data.employerIdTarget && (
          <div className="mt-2 bg-[#111111] border border-gray-800 rounded-md p-2 text-xs font-mono text-gray-400 truncate">
            EPFO ID: {data.employerIdTarget}
          </div>
        )}
      </div>

      <CustomHandle type="target" position={Position.Top} colorClass="bg-gray-600" />
      <CustomHandle type="source" position={Position.Bottom} colorClass="bg-gray-500" />
      <ErrorHandle />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';
DocumentClassificationNode.displayName = 'DocumentClassificationNode';
IntegrationNode.displayName = 'IntegrationNode';
ConditionNode.displayName = 'ConditionNode';
ExplainableAINode.displayName = 'ExplainableAINode';
MCAFilingSyncNode.displayName = 'MCAFilingSyncNode';
EPFOAnomalyNode.displayName = 'EPFOAnomalyNode';
