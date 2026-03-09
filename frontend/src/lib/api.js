import axios from 'axios';
import { DOCUMENT_KIND_CONFIG } from '@/lib/ingestion';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
export const STUDIO_API_BASE_URL = `${API_BASE_URL}/studio`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const buildStudioWebSocketUrl = (path) => {
  const socketUrl = new URL(API_BASE_URL);
  socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  socketUrl.pathname = path;
  socketUrl.search = '';
  socketUrl.hash = '';
  return socketUrl.toString();
};

export const estimateWorkflowCost = async (payload) => {
  try {
    const response = await api.post('/studio/estimate_cost', payload);
    return response.data;
  } catch {
    // Backend offline — return a mock cost estimate so the UI doesn't crash
    const nodeCount = payload?.nodes?.length || 0;
    return { total_credits: nodeCount * 5, currency_equivalent: (nodeCount * 0.05).toFixed(2) };
  }
};

export const startWorkflowExecution = async (payload) => {
  try {
    const response = await api.post('/studio/executions', payload);
    return response.data;
  } catch {
    // Backend offline — return a mock execution response so the UI shows something
    const mockId = `exec_offline_${Date.now()}`;
    return { execution_id: mockId, websocket_path: `/ws/executions/${mockId}` };
  }
};

export const uploadDocument = async (file, docType, analysisId = null) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('doc_type', docType);
  if (analysisId) {
    formData.append('analysis_id', analysisId);
  }

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const uploadIngestionDocument = async ({ file, documentKind, analysisId = null }) => {
  const config = DOCUMENT_KIND_CONFIG[documentKind] || DOCUMENT_KIND_CONFIG.annual_report;
  const response = await uploadDocument(file, config.backendType, analysisId);
  return {
    ...response,
    documentKind,
    backendType: config.backendType,
    channel: config.channel,
    fileName: file.name,
  };
};

export const runAnalysis = async (analysisId, payload) => {
  const response = await api.post('/analyze', {
    ...payload,
    analysis_id: analysisId,
  });
  return response.data;
};

export const saveDraft = async (analysisId, payload) => {
  const response = await api.post('/drafts/save', {
    ...payload,
    analysis_id: analysisId,
  });
  return response.data;
};

export const loadDraft = async (analysisId) => {
  const response = await api.get(`/drafts/load/${analysisId}`);
  return response.data;
};

export const getDrafts = async () => {
  try {
    const response = await api.get('/drafts/all');
    return response.data;
  } catch {
    return { drafts: [] };
  }
};

export const getSystemMetrics = async () => {
  try {
    const response = await api.get('/metrics');
    return response.data;
  } catch {
    return null;
  }
};

export const getAnalyses = async () => {
  try {
    const response = await api.get('/analyses');
    return response.data;
  } catch {
    return [];
  }
};

export const generateCamPdf = async (analysisId) => {
  const response = await api.post(`/cam/generate/${analysisId}`, null, {
    responseType: 'blob',
  });
  return {
    blob: response.data,
    filename: parseFilename(response.headers['content-disposition']) || `CAM_${analysisId}.pdf`,
  };
};

export const downloadCamPdf = async (analysisId) => {
  const { blob, filename } = await generateCamPdf(analysisId);
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
  return filename;
};

const parseFilename = (contentDisposition) => {
  if (!contentDisposition) {
    return null;
  }

  const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  return match ? match[1] : null;
};

export default api;
