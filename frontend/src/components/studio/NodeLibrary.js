"use client";

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  GitBranch,
  Play,
  Share2,
  ShieldEllipsis,
  Building2,
  AlertTriangle,
} from 'lucide-react';

export const NODE_LIBRARY_GROUPS = [
  {
    id: 'triggers',
    label: 'Triggers',
    accent: 'emerald',
    items: [
      {
        type: 'triggerNode',
        label: 'Manual Trigger',
        description: 'Starts the workflow with uploaded Databricks payloads or manual input.',
        icon: Play,
      },
    ],
  },
  {
    id: 'ingestion',
    label: 'Data Ingestion',
    accent: 'violet',
    items: [
      {
        type: 'documentClassificationNode',
        label: 'Document Parser',
        description: 'Extract fields from GST, ITR, annual report, and OCR-derived payloads.',
        icon: FileCheck,
      },
      {
        type: 'mcaFilingSyncNode',
        label: 'MCA V3 Gateway',
        description: 'Synchronize corporate director footprints from MCA V3.',
        icon: Building2,
      },
      {
        type: 'epfoAnomalyNode',
        label: 'EPFO Anomalies',
        description: 'Fetch and parse EPFO compliance records for active employees.',
        icon: AlertTriangle,
      },
    ],
  },
  {
    id: 'logic',
    label: 'Logic',
    accent: 'rose',
    items: [
      {
        type: 'conditionNode',
        label: 'Condition Router',
        description: 'Branch on expressions and route true or false downstream.',
        icon: GitBranch,
      },
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    accent: 'amber',
    items: [
      {
        type: 'integrationNode',
        label: 'Integration Call',
        description: 'Call a downstream API using credentials and expression-mapped payloads.',
        icon: ShieldEllipsis,
      },
      {
        type: 'explainableAINode',
        label: 'Explainability',
        description: 'Summarize score drivers and expose model rationale.',
        icon: Share2,
      },
    ],
  },
];

const ACCENT_STYLES = {
  emerald: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: 'bg-emerald-100 text-emerald-700',
  },
  violet: {
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    icon: 'bg-violet-100 text-violet-700',
  },
  rose: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: 'bg-rose-100 text-rose-700',
  },
  amber: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: 'bg-amber-100 text-amber-700',
  },
};

export default function NodeLibrary({ collapsed, onToggle, onDragStart }) {
  const [openGroups, setOpenGroups] = useState({
    triggers: true,
    ingestion: true,
    logic: true,
    actions: true,
  });

  const toggleGroup = (groupId) => {
    setOpenGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  };

  if (collapsed) {
    return (
      <aside className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-3 shrink-0">
        <button
          onClick={onToggle}
          className="w-10 h-10 rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center"
          aria-label="Open node library"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        {NODE_LIBRARY_GROUPS.map((group) => {
          const preview = group.items[0];
          const Icon = preview.icon;
          const tone = ACCENT_STYLES[group.accent] || ACCENT_STYLES.emerald;
          return (
            <button
              key={group.id}
              onClick={onToggle}
              className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${tone.badge}`}
              title={group.label}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </aside>
    );
  }

  return (
    <aside className="w-[320px] bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Node Library</p>
          <h2 className="text-lg font-bold text-slate-900 mt-1">Compose the workflow graph</h2>
          <p className="text-sm text-slate-500 mt-1">Drag nodes onto the canvas. Delete from the keyboard or with the trash control.</p>
        </div>
        <button
          onClick={onToggle}
          className="w-10 h-10 rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center"
          aria-label="Collapse node library"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 bg-[radial-gradient(circle_at_top_left,_rgba(37,78,221,0.08),_transparent_40%)]">
        {NODE_LIBRARY_GROUPS.map((group) => {
          const tone = ACCENT_STYLES[group.accent] || ACCENT_STYLES.emerald;
          const isOpen = openGroups[group.id];
          return (
            <section key={group.id} className="rounded-3xl border border-slate-200 bg-slate-50/70 backdrop-blur-sm overflow-hidden">
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/70 transition-colors"
              >
                <div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${tone.badge}`}>
                    {group.label}
                  </span>
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
              </button>

              {isOpen && (
                <div className="px-3 pb-3 space-y-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.type}
                        draggable
                        onDragStart={(event) => onDragStart(event, item.type)}
                        className="group rounded-2xl border border-slate-200 bg-white p-4 cursor-grab active:cursor-grabbing hover:border-slate-300 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${tone.icon}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="text-sm font-semibold text-slate-900">{item.label}</h3>
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Drag</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 leading-5">{item.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
