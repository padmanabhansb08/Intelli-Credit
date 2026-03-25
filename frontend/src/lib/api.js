import axios from 'axios';
import { DOCUMENT_KIND_CONFIG } from '@/lib/ingestion';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
export const STUDIO_API_BASE_URL = `${API_BASE_URL}/decision-studio`;

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
  const response = await api.post('/decision-studio/estimate_cost', payload);
  return response.data;
};

export const startWorkflowExecution = async (payload) => {
  // Ephemeral Draft Execution - sends raw DAG directly without MongoDB lookup
  try {
    const executeResponse = await api.post(`/decision-studio/execute-draft`, {
      trigger_payload: {
        applicant_name: payload.initial_input?.applicant_name || "Acme Corp",
        pan_number: payload.initial_input?.pan_number || "ABCDE1234F",
        loan_amount: payload.initial_input?.loan_amount || payload.initial_input?.requested_amount || 50000,
        pdf_urls: payload.initial_input?.pdf_urls || ["mock_url"]
      },
      nodes: payload.nodes,
      edges: payload.edges
    });

    return executeResponse.data;
  } catch (error) {
    // Extract meaningful error message for the frontend
    const errorDetail = error.response?.data?.detail;

    if (error.response?.status === 400) {
      // Handle DAG cycle detection
      const cycleError = errorDetail?.error || "Invalid Workflow";
      const cycleNodes = errorDetail?.cycle_nodes || [];
      const userMessage = errorDetail?.message || "Cycle detected in workflow nodes";

      throw new Error(`${cycleError}: ${userMessage}`);
    }

    throw new Error(errorDetail?.message || errorDetail?.error || error.message || "Failed to execute workflow");
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
  const response = await api.get('/drafts/all');
  return response.data;
};

export const getSystemMetrics = async () => {
  const response = await api.get('/metrics');
  return response.data;
};

export const getAnalyses = async () => {
  const response = await api.get('/analyses');
  return response.data;
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

export const searchPortfolio = async (queryParams) => {
  const { q, status, industry, min_score, limit } = queryParams;
  const params = new URLSearchParams();

  if (q) params.append('q', q);
  if (status) params.append('status', status);
  if (industry) params.append('industry', industry);
  if (min_score !== undefined && min_score !== null) params.append('min_score', min_score);
  if (limit) params.append('limit', limit);

  const response = await api.get(`/portfolio/search?${params.toString()}`);
  return response.data;
};

const parseFilename = (contentDisposition) => {
  if (!contentDisposition) {
    return null;
  }

  const match = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  return match ? match[1] : null;
};

export default api;
