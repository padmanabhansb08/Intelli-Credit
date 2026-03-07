import axios from 'axios';

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
  const response = await api.post('/studio/estimate_cost', payload);
  return response.data;
};

export const startWorkflowExecution = async (payload) => {
  const response = await api.post('/studio/executions', payload);
  return response.data;
};

export const uploadDocument = async (file, docType) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('doc_type', docType);

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
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

export const downloadCamPdf = (analysisId) => {
  window.open(`${API_BASE_URL}/cam/download/${analysisId}`, '_blank');
};

export default api;

