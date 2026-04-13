"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  CheckCircle2,
  DatabaseZap,
  FileText,
  LoaderCircle,
  ScanSearch,
  Sparkles,
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import {
  buildDocumentDraft,
  buildWorkflowInitialInputFromDocuments,
  clearIngestionSession,
  clearWorkflowInitialInput,
  deriveProposalPatchFromDocuments,
  DOCUMENT_KIND_OPTIONS,
  persistIngestionSession,
  persistWorkflowInitialInput,
  readIngestionSession,
} from '@/lib/ingestion';
import { uploadIngestionDocument } from '@/lib/api';

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'text/csv': ['.csv'],
  'application/json': ['.json'],
};

const PIPELINE_STEPS = [
  { id: 'stage', label: 'Staging Files', icon: UploadCloud },
  { id: 'upload', label: 'Syncing to Databricks', icon: DatabaseZap },
  { id: 'extract', label: 'Extracting entities via Databricks OCR', icon: ScanSearch },
  { id: 'ready', label: 'Workflow trigger ready', icon: Sparkles },
];

const sleep = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 KB';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** exponent);
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const makeSerializableDocument = (document) => ({
  id: document.id,
  name: document.name,
  size: document.size,
  documentKind: document.documentKind,
  channel: document.channel,
  backendType: document.backendType,
  status: document.status,
  analysisId: document.analysisId,
  extractedData: document.extractedData,
  error: document.error,
});

export default function DocumentUploader({
  applicantName,
  requestedAmount,
  initialAnalysisId = null,
  onIngestionComplete,
}) {
  const [documents, setDocuments] = useState([]);
  const [analysisId, setAnalysisId] = useState(initialAnalysisId);
  const [pipelineStage, setPipelineStage] = useState('stage');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const storedSession = readIngestionSession();
    if (!storedSession) {
      return;
    }

    setAnalysisId(storedSession.analysisId || initialAnalysisId);
    setDocuments(
      Array.isArray(storedSession.documents)
        ? storedSession.documents.map((document) => ({
            ...document,
            file: null,
          }))
        : [],
    );
    setPipelineStage(storedSession.documents?.length ? 'ready' : 'stage');
  }, [initialAnalysisId]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: ACCEPTED_TYPES,
    multiple: true,
    noClick: true,
    disabled: isProcessing,
    onDrop: (acceptedFiles) => {
      if (!acceptedFiles.length) {
        return;
      }

      setErrorMessage(null);
      setPipelineStage('stage');
      setDocuments((current) => {
        const existingIds = new Set(current.map((document) => document.id));
        const nextDocuments = acceptedFiles
          .map((file) => buildDocumentDraft(file))
          .filter((document) => !existingIds.has(document.id));
        return [...current, ...nextDocuments];
      });
    },
  });

  const completedDocuments = useMemo(
    () => documents.filter((document) => document.status === 'complete' && document.extractedData),
    [documents],
  );

  const updateDocument = (documentId, patch) => {
    setDocuments((current) => current.map((document) => (
      document.id === documentId
        ? {
            ...document,
            ...patch,
          }
        : document
    )));
  };

  const removeDocument = (documentId) => {
    if (isProcessing) {
      return;
    }
    setDocuments((current) => current.filter((document) => document.id !== documentId));
  };

  const clearAll = () => {
    if (isProcessing) {
      return;
    }

    setDocuments([]);
    setAnalysisId(initialAnalysisId);
    setPipelineStage('stage');
    setErrorMessage(null);
    clearIngestionSession();
    clearWorkflowInitialInput();
  };

  const finalizeIngestion = (nextAnalysisId, nextDocuments) => {
    const workflowInitialInput = buildWorkflowInitialInputFromDocuments({
      documents: nextDocuments,
      requestedAmount,
      applicantName,
    });
    const proposalPatch = deriveProposalPatchFromDocuments(nextDocuments);
    const serializedDocuments = nextDocuments.map(makeSerializableDocument);

    persistWorkflowInitialInput(workflowInitialInput);
    persistIngestionSession({
      analysisId: nextAnalysisId,
      documents: serializedDocuments,
      workflowInitialInput,
      proposalPatch,
    });

    onIngestionComplete?.({
      analysisId: nextAnalysisId,
      documents: serializedDocuments,
      workflowInitialInput,
      proposalPatch,
    });
  };

  const processDocuments = async () => {
    if (!documents.length || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setPipelineStage('upload');

    let nextAnalysisId = analysisId || initialAnalysisId;
    let workingDocuments = documents.map((document) => ({ ...document }));
    let currentDocumentId = null;

    try {
      for (const document of workingDocuments) {
        if (document.status === 'complete' && document.extractedData) {
          if (!nextAnalysisId && document.analysisId) {
            nextAnalysisId = document.analysisId;
          }
          continue;
        }

        if (!document.file) {
          throw new Error(`Re-add ${document.name} before retrying extraction.`);
        }

        currentDocumentId = document.id;
        setActiveDocumentId(document.id);
        workingDocuments = workingDocuments.map((item) => (
          item.id === document.id
            ? { ...item, status: 'uploading', error: null }
            : item
        ));
        setDocuments(workingDocuments.map((item) => ({ ...item })));

        const response = await uploadIngestionDocument({
          file: document.file,
          documentKind: document.documentKind,
          analysisId: nextAnalysisId,
        });

        nextAnalysisId = response.analysis_id;
        setAnalysisId(nextAnalysisId);
        setPipelineStage('extract');

        workingDocuments = workingDocuments.map((item) => (
          item.id === document.id
            ? {
                ...item,
                status: 'extracting',
                analysisId: nextAnalysisId,
              }
            : item
        ));
        setDocuments(workingDocuments.map((item) => ({ ...item })));

        await sleep(500);

        workingDocuments = workingDocuments.map((item) => (
          item.id === document.id
            ? {
                ...item,
                status: 'complete',
                analysisId: nextAnalysisId,
                extractedData: response.extracted_data,
                backendType: response.backendType,
                channel: response.channel,
                error: null,
              }
            : item
        ));
        setDocuments(workingDocuments.map((item) => ({ ...item })));
      }

      const nextDocuments = workingDocuments.filter((document) => document.status === 'complete' && document.extractedData);
      setPipelineStage('ready');
      setActiveDocumentId(null);
      finalizeIngestion(nextAnalysisId, nextDocuments);
    } catch (error) {
      const message = error.response?.data?.detail || error.message || 'Failed to ingest documents.';
      setErrorMessage(message);
      if (currentDocumentId) {
        updateDocument(currentDocumentId, {
          status: 'error',
          error: message,
        });
      }
    } finally {
      setActiveDocumentId(null);
      setIsProcessing(false);
    }
  };

  const currentStepIndex = PIPELINE_STEPS.findIndex((step) => step.id === pipelineStage);

  return (
    <div className="rounded-[28px] border border-slate-700 bg-slate-950/60 p-6 md:p-7 space-y-6 shadow-[0_30px_80px_rgba(15,23,42,0.45)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">Databricks Ingestion</p>
          <h3 className="text-xl font-bold text-white mt-2">Upload source documents for the decision graph</h3>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl">
            Categorize each file as structured or unstructured input, extract entities, and attach the resulting payload to the workflow trigger.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={open}
            disabled={isProcessing}
            className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/20 transition-colors disabled:opacity-60"
          >
            Add documents
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={isProcessing || !documents.length}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-900 transition-colors disabled:opacity-50"
          >
            Clear queue
          </button>
        </div>
      </div>

      <div
        {...getRootProps()}
        className={`rounded-[26px] border-2 border-dashed p-8 text-center transition-all ${
          isDragActive
            ? 'border-cyan-400 bg-cyan-400/10'
            : 'border-slate-700 bg-slate-900/60 hover:border-slate-500'
        }`}
      >
        <input {...getInputProps()} />
        <div className="w-16 h-16 rounded-3xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center mx-auto">
          <UploadCloud className="w-8 h-8 text-cyan-300" />
        </div>
        <h4 className="text-lg font-semibold text-white mt-5">Drop GST filings, ITRs, bank statements, and annual reports</h4>
        <p className="text-sm text-slate-400 mt-2">PDF, CSV, and JSON inputs are supported. Files are parsed into a workflow-ready event payload.</p>
        <button
          type="button"
          onClick={open}
          disabled={isProcessing}
          className="mt-5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100 transition-colors disabled:opacity-60"
        >
          Browse files
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {PIPELINE_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStepIndex === index && isProcessing;
          const isComplete = currentStepIndex > index || (!isProcessing && pipelineStage === 'ready' && index <= currentStepIndex);
          return (
            <div
              key={step.id}
              className={`rounded-2xl border px-4 py-3 ${
                isActive
                  ? 'border-cyan-400/40 bg-cyan-400/10'
                  : isComplete
                    ? 'border-emerald-400/30 bg-emerald-400/10'
                    : 'border-slate-700 bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isActive ? 'bg-cyan-400/15 text-cyan-200' : isComplete ? 'bg-emerald-400/15 text-emerald-200' : 'bg-slate-800 text-slate-400'}`}>
                  {isActive ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Step {index + 1}</p>
                  <p className="text-sm font-semibold text-white leading-5">{step.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </div>
      )}

      <div className="space-y-3">
        {documents.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-6 text-sm text-slate-500">
            No documents queued yet. Add files to build the Databricks trigger payload.
          </div>
        ) : (
          documents.map((document) => {
            const isActiveDocument = activeDocumentId === document.id;
            return (
              <div key={document.id} className="rounded-[22px] border border-slate-800 bg-slate-900/60 px-5 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white truncate">{document.name}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${document.channel === 'structured' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-violet-400/10 text-violet-200'}`}>
                        {document.channel === 'structured' ? 'Structured' : 'Unstructured'}
                      </span>
                      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                        {formatFileSize(document.size)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      {document.analysisId ? `Analysis ${document.analysisId}` : 'Ready to ingest'}
                      {document.status === 'complete' && document.extractedData ? ' � Databricks extraction complete' : ''}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <select
                      value={document.documentKind}
                      disabled={isProcessing || document.status === 'complete'}
                      onChange={(event) => {
                        const selectedOption = DOCUMENT_KIND_OPTIONS.find((option) => option.value === event.target.value);
                        updateDocument(document.id, {
                          documentKind: event.target.value,
                          channel: selectedOption?.channel || document.channel,
                          backendType: selectedOption?.backendType || document.backendType,
                        });
                      }}
                      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                    >
                      {DOCUMENT_KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeDocument(document.id)}
                      disabled={isProcessing}
                      className="w-11 h-11 rounded-2xl border border-slate-700 bg-slate-950 text-slate-400 hover:text-rose-300 hover:border-rose-400/40 transition-colors flex items-center justify-center disabled:opacity-50"
                      aria-label={`Remove ${document.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                  {document.status === 'complete' && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1.5 font-semibold text-emerald-200"><CheckCircle2 className="w-3.5 h-3.5" /> Extracted</span>}
                  {document.status === 'uploading' && <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/10 px-3 py-1.5 font-semibold text-cyan-200"><LoaderCircle className="w-3.5 h-3.5 animate-spin" /> Uploading to Databricks</span>}
                  {document.status === 'extracting' && <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-400/10 px-3 py-1.5 font-semibold text-violet-200"><LoaderCircle className="w-3.5 h-3.5 animate-spin" /> Extracting entities via Databricks OCR...</span>}
                  {document.status === 'error' && <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-400/10 px-3 py-1.5 font-semibold text-rose-200"><XCircle className="w-3.5 h-3.5" /> {document.error || 'Failed'}</span>}
                  {document.status === 'queued' && <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 font-semibold text-slate-300"><FileText className="w-3.5 h-3.5" /> Queued</span>}
                  {isActiveDocument && isProcessing && <span className="text-cyan-200 font-medium">Currently processing this file.</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-[26px] border border-slate-800 bg-slate-950/70 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Workflow trigger payload</p>
          <p className="text-sm text-slate-400 mt-1">
            {completedDocuments.length > 0
              ? `${completedDocuments.length} document payload${completedDocuments.length > 1 ? 's' : ''} are attached to the studio trigger.`
              : 'Process at least one document to build the workflow input.'}
          </p>
          {analysisId && <p className="text-xs text-slate-500 mt-2">Analysis session: {analysisId}</p>}
        </div>
        <button
          type="button"
          onClick={processDocuments}
          disabled={!documents.length || isProcessing}
          className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300 transition-colors disabled:opacity-60 disabled:hover:bg-cyan-400"
        >
          {isProcessing ? 'Processing documents...' : completedDocuments.length === documents.length && documents.length > 0 ? 'Refresh extraction payload' : 'Extract with Databricks'}
        </button>
      </div>
    </div>
  );
}

