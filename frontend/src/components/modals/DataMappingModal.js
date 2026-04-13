"use client";

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Save, Trash2, X } from 'lucide-react';
import useWorkflowStore from '@/store/useWorkflowStore';
import { setValueAtPath } from '@/lib/ingestion';

const DEFAULT_RAW_DATA = {
  riskScore: 742,
  approvedLimit: 300000,
  flags: {
    bureau: 'clear',
    litigation: false,
  },
};

const RESPONSE_PATTERN = /\{\{\s*response\.(.*?)\s*\}\}/;

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const normalizeLeafValue = (value) => {
  if (typeof value === 'string') {
    return value;
  }
  if (value == null) {
    return 'null';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const tokenizePath = (path) => (
  path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
);

const joinResponsePath = (segments) => segments.reduce((accumulator, segment) => {
  if (/^\d+$/.test(segment)) {
    return `${accumulator}[${segment}]`;
  }
  return accumulator ? `${accumulator}.${segment}` : segment;
}, '');

const prettifyPath = (segments) => segments.map((segment) => (/^\d+$/.test(segment) ? `[${segment}]` : segment)).join(' > ');

const inferKeyName = (segments) => {
  const token = [...segments].reverse().find((segment) => !/^\d+$/.test(segment)) || 'value';
  return token.replace(/[^a-zA-Z0-9_.-]/g, '_');
};

const resolvePath = (value, path) => tokenizePath(path).reduce((current, segment) => {
  if (current == null) {
    return undefined;
  }
  return current[segment];
}, value);

const collectFieldMappings = (outputMapping, rawData) => {
  const mappings = [];

  const traverse = (value, pathSegments = []) => {
    if (typeof value === 'string') {
      const match = value.match(RESPONSE_PATTERN);
      if (!match) {
        return;
      }
      const responseSegments = tokenizePath(match[1]);
      mappings.push({
        path: prettifyPath(responseSegments),
        sourceSegments: responseSegments,
        keyName: pathSegments.join('.'),
        sampleValue: normalizeLeafValue(resolvePath(rawData, match[1])),
      });
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => traverse(item, [...pathSegments, String(index)]));
      return;
    }

    if (isObject(value)) {
      Object.entries(value).forEach(([key, nested]) => traverse(nested, [...pathSegments, key]));
    }
  };

  traverse(outputMapping);
  return mappings;
};

function JsonTreeNode({ value, pathSegments = [], expandedPaths, onToggle, onSelect }) {
  const pathKey = pathSegments.join('.') || 'root';

  if (!isObject(value) && !Array.isArray(value)) {
    return (
      <button
        type="button"
        onClick={() => onSelect(pathSegments, value)}
        className="ml-6 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-slate-100 transition-colors"
      >
        <span className="rounded-full bg-blue-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
          {pathSegments[pathSegments.length - 1] || 'value'}
        </span>
        <span className="truncate text-xs font-mono text-emerald-600">{normalizeLeafValue(value)}</span>
      </button>
    );
  }

  const isExpanded = expandedPaths.has(pathKey);
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item])
    : Object.entries(value);

  return (
    <div className={pathSegments.length ? 'ml-5' : ''}>
      <button
        type="button"
        onClick={() => onToggle(pathKey)}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-slate-100 transition-colors"
      >
        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
          {pathSegments[pathSegments.length - 1] || 'root'}
        </span>
        <span className="text-xs font-mono text-slate-400">{Array.isArray(value) ? '[ ] array' : '{ } object'}</span>
      </button>

      {isExpanded && (
        <div className="border-l border-slate-200 ml-3 mt-1 space-y-1">
          {entries.map(([key, nestedValue]) => (
            <JsonTreeNode
              key={`${pathKey}.${key}`}
              value={nestedValue}
              pathSegments={[...pathSegments, key]}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DataMappingModal() {
  const {
    closeMappingModal,
    mappingConfig,
    updateNodeData,
    workflowInitialInput,
  } = useWorkflowStore();

  const rawData = mappingConfig?.rawData && Object.keys(mappingConfig.rawData).length > 0
    ? mappingConfig.rawData
    : workflowInitialInput?.extracted && Object.keys(workflowInitialInput.extracted).length > 0
      ? workflowInitialInput.extracted
      : DEFAULT_RAW_DATA;

  const [selectedFields, setSelectedFields] = useState(() => {
    if (Array.isArray(mappingConfig?.fieldMappings) && mappingConfig.fieldMappings.length > 0) {
      return mappingConfig.fieldMappings;
    }
    if (mappingConfig?.existingMapping) {
      return collectFieldMappings(mappingConfig.existingMapping, rawData);
    }
    return [];
  });
  const [expandedPaths, setExpandedPaths] = useState(new Set(['root']));

  const togglePath = (pathKey) => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(pathKey)) {
        next.delete(pathKey);
      } else {
        next.add(pathKey);
      }
      return next;
    });
  };

  const addFieldSelection = (sourceSegments, value) => {
    const displayPath = prettifyPath(sourceSegments);
    if (selectedFields.some((field) => field.path === displayPath)) {
      return;
    }

    setSelectedFields((current) => [
      ...current,
      {
        path: displayPath,
        sourceSegments,
        keyName: inferKeyName(sourceSegments),
        sampleValue: normalizeLeafValue(value),
      },
    ]);
  };

  const removeField = (index) => {
    setSelectedFields((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const updateFieldKey = (index, nextKey) => {
    setSelectedFields((current) => current.map((field, itemIndex) => (
      itemIndex === index
        ? {
            ...field,
            keyName: nextKey,
          }
        : field
    )));
  };

  const mappedFields = selectedFields.reduce((accumulator, field) => {
    if (!field.keyName) {
      return accumulator;
    }
    return setValueAtPath(
      accumulator,
      field.keyName,
      `{{ response.${joinResponsePath(field.sourceSegments)} }}`,
    );
  }, {});

  const normalizedTargetRoot = (mappingConfig?.targetRoot || '').replace(/^data\./, '');
  const outputPayload = normalizedTargetRoot ? setValueAtPath({}, normalizedTargetRoot, mappedFields) : mappedFields;

  const handleSave = () => {
    if (!mappingConfig?.nodeId) {
      closeMappingModal();
      return;
    }

    updateNodeData(mappingConfig.nodeId, {
      outputMapping: outputPayload,
      fieldMappings: selectedFields,
    });
    closeMappingModal();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-6">
      <div className="bg-white w-full max-w-6xl h-[86vh] rounded-[28px] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Field Mapping</p>
            <h2 className="text-2xl font-bold text-slate-900 mt-2">Map response fields into node output</h2>
            <p className="text-sm text-slate-500 mt-2">
              Select values from the sample payload and persist them into {mappingConfig?.targetRoot || 'the node response'}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={closeMappingModal}
              className="w-11 h-11 rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 transition-colors flex items-center justify-center"
              aria-label="Close mapping modal"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-black transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save mapping
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 overflow-hidden">
          <div className="border-r border-slate-200 bg-slate-50/70 flex flex-col min-h-0">
            <div className="px-5 py-3 border-b border-slate-200 bg-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">1. Raw payload</p>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <JsonTreeNode
                value={rawData}
                expandedPaths={expandedPaths}
                onToggle={togglePath}
                onSelect={addFieldSelection}
              />
            </div>
          </div>

          <div className="border-r border-slate-200 bg-white flex flex-col min-h-0">
            <div className="px-5 py-3 border-b border-slate-200 bg-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">2. Selected fields</p>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {selectedFields.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Click values in the raw payload to map them into this node.
                </div>
              ) : (
                selectedFields.map((field, index) => (
                  <div key={`${field.path}-${index}`} className="rounded-3xl bg-[#254EDD] p-4 text-white shadow-lg shadow-blue-500/10">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-100">{field.path}</p>
                        <p className="text-xs text-blue-200 mt-1">Sample: {field.sampleValue}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeField(index)}
                        className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
                        aria-label={`Remove mapping ${field.path}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <label className="block text-xs font-semibold text-blue-100 mt-4 mb-2">Output field path</label>
                    <input
                      type="text"
                      value={field.keyName}
                      onChange={(event) => updateFieldKey(index, event.target.value)}
                      className="w-full rounded-2xl border border-blue-300/20 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-blue-300"
                      placeholder="credit_report.riskScore"
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-50/70 flex flex-col min-h-0">
            <div className="px-5 py-3 border-b border-slate-200 bg-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">3. Output preview</p>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm h-full">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Persisted node mapping</p>
                <pre className="text-xs leading-6 text-slate-700 whitespace-pre-wrap break-all font-mono">
                  {JSON.stringify(outputPayload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

