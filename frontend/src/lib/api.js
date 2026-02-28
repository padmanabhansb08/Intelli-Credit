import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
