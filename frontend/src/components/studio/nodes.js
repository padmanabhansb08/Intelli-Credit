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
    badge: 'bg-secondary/50 text-muted-foreground',
    ring: 'border-border',
  },
  running: {
    badge: 'bg-primary/20 text-primary',
    ring: 'border-primary shadow-primary/10',
  },
  retrying: {
    badge: 'bg-warning/20 text-warning',
    ring: 'border-warning shadow-warning/10',
  },
  success: {
    badge: 'bg-success/20 text-success',
    ring: 'border-success shadow-success/10',
  },
  failed: {
    badge: 'bg-destructive/20 text-destructive',
    ring: 'border-destructive shadow-destructive/10',
  },
  skipped: {
    badge: 'bg-muted text-muted-foreground',
    ring: 'border-muted-foreground/30',
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
    <div className={`relative flex flex-col items-center bg-card p-5 rounded-xl shadow-lg border-2 ${selected ? 'shadow-xl ring-2 ring-primary/20' : ''} ${tone.ring} transition-all`}>
      <RuntimeBadge data={data} />
      <div className="w-12 h-12 rounded-full bg-success/10 border border-success/30 flex items-center justify-center text-success mb-3">
        <Play className="w-5 h-5 ml-1" />
      </div>
      <span className="text-sm font-semibold text-foreground">{data.label}</span>
      <span className="text-[10px] text-muted-foreground mt-1 font-bold tracking-wider uppercase">Initiation</span>
      <CustomHandle type="source" position={Position.Bottom} colorClass="bg-success" />
    </div>
  );
});

export const DocumentClassificationNode = memo(({ data, selected }) => {
  const runtime = getRuntime(data);
  const tone = runtimeTone[runtime.status] || runtimeTone.idle;

  return (
    <div className={`relative w-80 bg-card/95 backdrop-blur-md rounded-xl shadow-md border-2 ${selected ? 'shadow-lg ring-2 ring-primary/20' : ''} ${tone.ring} p-0 overflow-hidden text-left transition-all group`}>
      <RuntimeBadge data={data} />
      <div className="bg-gradient-to-r from-primary/80 to-primary p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-primary-foreground shrink-0 backdrop-blur-sm">
          <FileText className="w-4 h-4" />
        </div>
        <div className="flex flex-col text-primary-foreground flex-1 pr-20">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">IDP Extraction</span>
          <span className="text-sm font-semibold">{data.label || 'Document Classifier'}</span>
        </div>
        {data.confidence && (
          <div className="bg-white/20 border border-white/30 px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-md">
            <CheckCircle2 className="w-3 h-3 text-white" />
            <span className="text-[10px] font-bold text-white">{data.confidence}%</span>
          </div>
        )}
      </div>

      {data.error && (
        <div className="bg-destructive/10 border-b border-destructive/20 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-destructive font-semibold">{data.error}</p>
            <button className="mt-2 text-xs bg-background border border-border text-foreground px-3 py-1.5 rounded-md font-semibold flex items-center gap-1 hover:bg-muted transition-colors shadow-sm">
              <RefreshCw className="w-3 h-3" /> Re-upload Document
            </button>
          </div>
        </div>
      )}

      {!data.error && data.extractedFields && (
        <div className="p-3 bg-secondary/20 border-b border-border">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2 block">Extracted Entities</span>
          <div className="bg-background rounded-md border border-border overflow-hidden shadow-sm">
            {data.extractedFields.map((field, idx) => (
              <div key={idx} className={`flex justify-between p-1.5 px-3 text-xs ${idx !== data.extractedFields.length - 1 ? 'border-b border-border/50' : ''}`}>
                <span className="text-muted-foreground font-medium">{field.key}</span>
                <span className="text-foreground font-semibold font-mono">{field.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-2.5 bg-card flex justify-between items-center px-4">
        <span className="text-[10px] text-muted-foreground font-medium">Model: <span className="text-foreground font-semibold">SciBERT+Flan-T5</span></span>
        {runtime.durationMs != null && <span className="text-[10px] text-muted-foreground">{runtime.durationMs} ms</span>}
      </div>

      <CustomHandle type="target" position={Position.Top} colorClass="bg-success" />
      <CustomHandle type="source" position={Position.Bottom} colorClass="bg-primary" />
      <ErrorHandle />
    </div>
  );
});

export const IntegrationNode = memo(({ data, selected }) => {
  const runtime = getRuntime(data);
  const tone = runtimeTone[runtime.status] || runtimeTone.idle;

  return (
    <div className={`relative w-72 bg-card rounded-xl shadow-md border-2 ${selected ? 'ring-2 ring-primary/30 shadow-lg' : ''} ${tone.ring} flex items-stretch overflow-hidden transition-all text-left`}>
      <RuntimeBadge data={data} />
      <div className="w-1.5 bg-primary opacity-80 shrink-0"></div>

      <div className="p-3 flex-1 flex flex-col gap-2 pr-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] text-primary font-bold uppercase tracking-wider truncate">{data.connection || 'API Gateway'}</span>
            <span className="text-sm font-semibold text-foreground truncate">{data.label}</span>
          </div>
        </div>

        {data.warning && (
          <div className="mt-2 bg-warning/10 border border-warning/20 rounded-md p-2 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <span className="text-xs text-warning font-medium">{data.warningDetails || 'High latency detected down-stream.'}</span>
          </div>
        )}

        {runtime.error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-2 text-xs text-destructive font-medium">
            {runtime.error}
          </div>
        )}
      </div>

      <CustomHandle type="target" position={Position.Top} colorClass="bg-primary/50" />
      <CustomHandle type="source" position={Position.Bottom} colorClass="bg-primary" />
      <ErrorHandle />
    </div>
  );
});

export const ConditionNode = memo(({ data, selected }) => {
  const runtime = getRuntime(data);
  const tone = runtimeTone[runtime.status] || runtimeTone.idle;

  return (
    <div className={`relative w-64 bg-card rounded-xl shadow-md border-2 ${selected ? 'shadow-lg ring-2 ring-primary/20' : ''} ${tone.ring} p-4 flex flex-col transition-all text-left`}>
      <RuntimeBadge data={data} />
      <div className="flex items-center gap-3 mb-3 pr-20">
        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-foreground shrink-0 border border-border">
          <Share2 className="w-5 h-5 opacity-70" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Routing Logic</span>
          <span className="text-sm font-semibold text-foreground truncate">{data.label}</span>
        </div>
      </div>

      <div className="bg-background rounded-lg p-2.5 border border-border">
        <span className="text-xs text-muted-foreground font-mono break-all line-clamp-2">{data.expression || data.assignmentDetails}</span>
      </div>

      {runtime.output?.branch && (
        <div className="mt-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
          Branch Evaluated: <span className="text-foreground">{runtime.output.branch}</span>
        </div>
      )}

      <CustomHandle type="target" position={Position.Top} colorClass="bg-primary/60" />
      <CustomHandle type="source" position={Position.Bottom} id="true" colorClass="bg-success" style={{ left: '33%' }} />
      <CustomHandle type="source" position={Position.Bottom} id="false" colorClass="bg-destructive" style={{ left: '67%' }} />

      <div className="absolute -bottom-6 w-full flex justify-between px-8 text-[9px] font-bold uppercase tracking-wider opacity-60">
        <span className="text-success">TRUE</span>
        <span className="text-destructive">FALSE</span>
      </div>
    </div>
  );
});

export const ExplainableAINode = memo(({ data, selected }) => {
  const runtime = getRuntime(data);
  const tone = runtimeTone[runtime.status] || runtimeTone.idle;

  return (
    <div className={`relative w-80 bg-card rounded-xl shadow-md border-2 ${selected ? 'shadow-lg ring-2 ring-primary/20' : ''} ${tone.ring} p-0 overflow-hidden text-left transition-all`}>
      <RuntimeBadge data={data} />
      <div className="bg-gradient-to-r from-indigo-500/80 to-indigo-500 p-3 flex items-center gap-3 pr-20">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0 backdrop-blur-sm">
          <Share2 className="w-4 h-4" />
        </div>
        <div className="flex flex-col text-white min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Interpretability</span>
          <span className="text-sm font-semibold truncate">{data.label || 'TreeSHAP Explainer'}</span>
        </div>
      </div>

      <div className="p-4 bg-secondary/10">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Feature Impact</span>
        </div>

        {data.shapValues && (
          <div className="flex flex-col gap-2">
            {data.shapValues.map((feature, idx) => (
              <div key={idx} className="flex flex-col">
                <div className="flex justify-between text-[10px] font-semibold mb-1">
                  <span className="text-muted-foreground">{feature.name}</span>
                  <span className={feature.impact > 0 ? 'text-destructive' : 'text-success'}>
                    {feature.impact > 0 ? '+' : ''}{feature.impact.toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden flex">
                  <div
                    className={`h-full ${feature.impact > 0 ? 'bg-destructive' : 'bg-success'}`}
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

      <div className="p-2.5 border-t border-border bg-card flex justify-between items-center px-4">
        <span className="text-[10px] text-muted-foreground font-medium">Model: <span className="text-foreground font-semibold">XGBoost</span></span>
        {runtime.output?.summary && <span className="text-[10px] text-muted-foreground truncate max-w-40">{runtime.output.summary}</span>}
      </div>

      <CustomHandle type="target" position={Position.Top} colorClass="bg-primary/60" />
      <CustomHandle type="source" position={Position.Bottom} colorClass="bg-indigo-500" />
      <ErrorHandle />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';
DocumentClassificationNode.displayName = 'DocumentClassificationNode';
IntegrationNode.displayName = 'IntegrationNode';
ConditionNode.displayName = 'ConditionNode';
ExplainableAINode.displayName = 'ExplainableAINode';

