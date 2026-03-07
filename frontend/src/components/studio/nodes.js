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
    badge: 'bg-slate-100 text-slate-600',
    ring: 'border-slate-200',
  },
  running: {
    badge: 'bg-blue-100 text-blue-700',
    ring: 'border-blue-500 shadow-blue-500/15',
  },
  retrying: {
    badge: 'bg-amber-100 text-amber-700',
    ring: 'border-amber-500 shadow-amber-500/15',
  },
  success: {
    badge: 'bg-emerald-100 text-emerald-700',
    ring: 'border-emerald-500 shadow-emerald-500/15',
  },
  failed: {
    badge: 'bg-rose-100 text-rose-700',
    ring: 'border-rose-500 shadow-rose-500/15',
  },
  skipped: {
    badge: 'bg-slate-200 text-slate-600',
    ring: 'border-slate-300',
  },
};

const getRuntime = (data) => data.runtime || { status: 'idle' };

const CustomHandle = ({ type, position, colorClass, id, style }) => (
  <Handle
    type={type}
    position={position}
    id={id}
    style={style}
    className={`w-3 h-3 ${colorClass} border-2 border-white transition-all hover:scale-125 z-50`}
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
    colorClass="bg-rose-500"
    style={{ top: '50%' }}
  />
);

export const TriggerNode = memo(({ data, selected }) => {
  const runtime = getRuntime(data);
  const tone = runtimeTone[runtime.status] || runtimeTone.idle;

  return (
    <div className={`relative flex flex-col items-center bg-white p-4 rounded-xl shadow-lg border-2 ${selected ? 'shadow-xl' : ''} ${tone.ring} transition-all`}>
      <RuntimeBadge data={data} />
      <div className="w-12 h-12 rounded-full bg-emerald-500 shadow-emerald-500/40 shadow-inner flex items-center justify-center text-white mb-3">
        <Play className="w-6 h-6 fill-current ml-1" />
      </div>
      <span className="text-sm font-bold text-slate-700">{data.label}</span>
      <span className="text-xs text-slate-400 mt-1 font-medium tracking-wide uppercase">Initiation</span>
      <CustomHandle type="source" position={Position.Bottom} colorClass="bg-emerald-500" />
    </div>
  );
});

export const DocumentClassificationNode = memo(({ data, selected }) => {
  const runtime = getRuntime(data);
  const tone = runtimeTone[runtime.status] || runtimeTone.idle;

  return (
    <div className={`relative w-80 bg-white/80 backdrop-blur-md rounded-xl shadow-xl border-2 ${selected ? 'shadow-2xl' : ''} ${tone.ring} p-0 overflow-hidden text-left transition-all group`}>
      <RuntimeBadge data={data} />
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0 backdrop-blur-sm shadow-sm">
          <FileText className="w-4 h-4" />
        </div>
        <div className="flex flex-col text-white flex-1 pr-20">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-200">IDP Extraction</span>
          <span className="text-sm font-bold shadow-sm">{data.label || 'Document Classifier'}</span>
        </div>
        {data.confidence && (
          <div className="bg-emerald-400/20 border border-emerald-400/30 px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-md shadow-sm">
            <CheckCircle2 className="w-3 h-3 text-emerald-300" />
            <span className="text-xs font-bold text-emerald-100">{data.confidence}%</span>
          </div>
        )}
      </div>

      {data.error && (
        <div className="bg-rose-50 border-b border-rose-100 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-rose-700 font-medium">{data.error}</p>
            <button className="mt-2 text-xs bg-white border border-rose-200 text-rose-600 px-3 py-1.5 rounded-md font-bold flex items-center gap-1 hover:bg-rose-100 transition-colors shadow-sm">
              <RefreshCw className="w-3 h-3" /> Re-upload Document
            </button>
          </div>
        </div>
      )}

      {!data.error && data.extractedFields && (
        <div className="p-3 bg-slate-50 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-500 mb-2 block">Extracted Entities</span>
          <div className="bg-white rounded-md border border-slate-200 overflow-hidden shadow-sm">
            {data.extractedFields.map((field, idx) => (
              <div key={idx} className={`flex justify-between p-1.5 px-3 text-xs ${idx !== data.extractedFields.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <span className="text-slate-500 font-medium">{field.key}</span>
                <span className="text-slate-800 font-bold font-mono">{field.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-2 bg-white flex justify-between items-center px-4">
        <span className="text-[10px] text-slate-400 font-medium">Model: <span className="text-slate-600 font-bold">SciBERT+Flan-T5</span></span>
        {runtime.durationMs != null && <span className="text-[10px] text-slate-500">{runtime.durationMs} ms</span>}
      </div>

      <CustomHandle type="target" position={Position.Top} colorClass="bg-emerald-500" />
      <CustomHandle type="source" position={Position.Bottom} colorClass="bg-purple-500" />
      <ErrorHandle />
    </div>
  );
});

export const IntegrationNode = memo(({ data, selected }) => {
  const runtime = getRuntime(data);
  const tone = runtimeTone[runtime.status] || runtimeTone.idle;

  return (
    <div className={`relative w-72 bg-white rounded-xl shadow-lg border-2 ${selected ? 'ring-4 ring-blue-500/10' : ''} ${tone.ring} flex items-stretch overflow-hidden transition-all text-left`}>
      <RuntimeBadge data={data} />
      <div className="w-2 bg-blue-500 shrink-0"></div>

      <div className="p-3 flex-1 flex flex-col gap-2 pr-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-inner">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-blue-500 font-bold uppercase tracking-wider truncate">{data.connection || 'API Gateway'}</span>
            <span className="text-sm font-bold text-slate-800 truncate">{data.label}</span>
          </div>
        </div>

        {data.warning && (
          <div className="mt-2 bg-orange-50 border border-orange-200 rounded-md p-2 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <span className="text-xs text-orange-700 font-medium">{data.warningDetails || 'High latency detected in downstream system.'}</span>
          </div>
        )}

        {runtime.error && (
          <div className="bg-rose-50 border border-rose-200 rounded-md p-2 text-xs text-rose-700 font-medium">
            {runtime.error}
          </div>
        )}
      </div>

      <CustomHandle type="target" position={Position.Top} colorClass="bg-purple-500" />
      <CustomHandle type="source" position={Position.Bottom} colorClass="bg-blue-500" />
      <ErrorHandle />
    </div>
  );
});

export const ConditionNode = memo(({ data, selected }) => {
  const runtime = getRuntime(data);
  const tone = runtimeTone[runtime.status] || runtimeTone.idle;

  return (
    <div className={`relative w-64 bg-slate-900 rounded-xl shadow-2xl border-2 ${selected ? 'shadow-pink-500/20' : ''} ${tone.ring} p-4 flex flex-col transition-all text-left`}>
      <RuntimeBadge data={data} />
      <div className="flex items-center gap-3 mb-3 pr-20">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white shrink-0 shadow-lg">
          <Share2 className="w-5 h-5" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] text-pink-400 font-bold uppercase tracking-widest">Routing Logic</span>
          <span className="text-sm font-bold text-white truncate">{data.label}</span>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700">
        <span className="text-xs text-slate-300 font-mono break-all">{data.expression || data.assignmentDetails}</span>
      </div>

      {runtime.output?.branch && (
        <div className="mt-3 text-[11px] font-semibold text-slate-300 uppercase tracking-wide">
          Branch: <span className="text-white">{runtime.output.branch}</span>
        </div>
      )}

      <CustomHandle type="target" position={Position.Top} colorClass="bg-blue-500" />
      <CustomHandle type="source" position={Position.Bottom} id="true" colorClass="bg-emerald-500" style={{ left: '33%' }} />
      <CustomHandle type="source" position={Position.Bottom} id="false" colorClass="bg-rose-500" style={{ left: '67%' }} />

      <div className="absolute -bottom-6 w-full flex justify-between px-8 text-[10px] font-bold opacity-75">
        <span className="text-emerald-500 drop-shadow-sm">TRUE</span>
        <span className="text-rose-500 drop-shadow-sm">FALSE</span>
      </div>
    </div>
  );
});

export const ExplainableAINode = memo(({ data, selected }) => {
  const runtime = getRuntime(data);
  const tone = runtimeTone[runtime.status] || runtimeTone.idle;

  return (
    <div className={`relative w-80 bg-white rounded-xl shadow-xl border-2 ${selected ? 'shadow-amber-500/20' : ''} ${tone.ring} p-0 overflow-hidden text-left transition-all`}>
      <RuntimeBadge data={data} />
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-3 flex items-center gap-3 pr-20">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0 shadow-sm">
          <Share2 className="w-4 h-4" />
        </div>
        <div className="flex flex-col text-white min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Interpretability</span>
          <span className="text-sm font-bold shadow-sm truncate">{data.label || 'TreeSHAP Explainer'}</span>
        </div>
      </div>

      <div className="p-3 bg-slate-50">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold text-slate-500 block">Feature Impact Matrix</span>
          <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">Platt Calibrated</span>
        </div>

        {data.shapValues && (
          <div className="flex flex-col gap-1.5">
            {data.shapValues.map((feature, idx) => (
              <div key={idx} className="flex flex-col">
                <div className="flex justify-between text-[10px] font-medium mb-0.5">
                  <span className="text-slate-600">{feature.name}</span>
                  <span className={feature.impact > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                    {feature.impact > 0 ? '+' : ''}{feature.impact.toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full ${feature.impact > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}
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

      <div className="p-2 border-t border-slate-100 bg-white flex justify-between items-center px-4">
        <span className="text-[10px] text-slate-400 font-medium">Model: <span className="text-slate-600 font-bold">XGBoost (Credit Risk)</span></span>
        {runtime.output?.summary && <span className="text-[10px] text-slate-500 truncate max-w-40">{runtime.output.summary}</span>}
      </div>

      <CustomHandle type="target" position={Position.Top} colorClass="bg-blue-500" />
      <CustomHandle type="source" position={Position.Bottom} colorClass="bg-amber-500" />
      <ErrorHandle />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';
DocumentClassificationNode.displayName = 'DocumentClassificationNode';
IntegrationNode.displayName = 'IntegrationNode';
ConditionNode.displayName = 'ConditionNode';
ExplainableAINode.displayName = 'ExplainableAINode';

