"use client";

import React from 'react';
import { PanelBottomClose, PanelBottomOpen, Radio, WifiOff } from 'lucide-react';

const statusTone = {
  idle: 'bg-slate-100 text-slate-600',
  queued: 'bg-slate-100 text-slate-700',
  running: 'bg-blue-100 text-blue-700',
  success: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
};

const levelTone = {
  INFO: 'text-slate-600',
  SUCCESS: 'text-emerald-600',
  WARN: 'text-amber-600',
  ERROR: 'text-rose-600',
};

export default function ExecutionPanel({
  isOpen,
  onToggle,
  logs,
  executionStatus,
  websocketStatus,
  currentExecutionId,
}) {
  return (
    <div className={`border-t border-slate-200 bg-white transition-[height] duration-200 ${isOpen ? 'h-72' : 'h-14'}`}>
      <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggle}
            className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          >
            {isOpen ? <PanelBottomClose className="w-4 h-4" /> : <PanelBottomOpen className="w-4 h-4" />}
          </button>
          <div>
            <p className="text-sm font-semibold text-slate-800">Execution Trace</p>
            <p className="text-xs text-slate-500">
              {currentExecutionId ? `Run ${currentExecutionId}` : 'No active execution'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusTone[executionStatus] || statusTone.idle}`}>
            {executionStatus}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 flex items-center gap-1.5">
            {websocketStatus === 'connected' ? <Radio className="w-3 h-3 text-emerald-500" /> : <WifiOff className="w-3 h-3 text-slate-400" />}
            {websocketStatus}
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="h-[calc(100%-3.5rem)] overflow-y-auto p-4 bg-slate-950 text-slate-100 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              Execute a workflow to stream node-level events.
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="grid grid-cols-[148px_128px_1fr] gap-4 border-b border-slate-900/80 pb-2 last:border-b-0">
                  <span className="text-slate-500">{log.timestamp || 'pending'}</span>
                  <span className={`${levelTone[log.level] || levelTone.INFO} uppercase tracking-wide`}>
                    {log.level} {log.nodeLabel ? `· ${log.nodeLabel}` : ''}
                  </span>
                  <span className="text-slate-200">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

