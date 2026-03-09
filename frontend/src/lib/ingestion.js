export const WORKFLOW_INITIAL_INPUT_STORAGE_KEY = 'intelli.workflowInitialInput';
export const INGESTION_SESSION_STORAGE_KEY = 'intelli.documentIngestion';

export const DOCUMENT_KIND_CONFIG = {
  gst_filing: {
    label: 'GST Filing',
    channel: 'structured',
    backendType: 'financial_pdf',
    accept: ['.pdf'],
  },
  itr_statement: {
    label: 'ITR / Financial Statement',
    channel: 'structured',
    backendType: 'financial_pdf',
    accept: ['.pdf'],
  },
  bank_statement: {
    label: 'Bank Statement',
    channel: 'structured',
    backendType: 'bank_csv',
    accept: ['.csv'],
  },
  bureau_report: {
    label: 'Bureau Report JSON',
    channel: 'structured',
    backendType: 'bureau_json',
    accept: ['.json'],
  },
  annual_report: {
    label: 'Annual Report / PDF',
    channel: 'unstructured',
    backendType: 'financial_pdf',
    accept: ['.pdf'],
  },
};

export const DOCUMENT_KIND_OPTIONS = Object.entries(DOCUMENT_KIND_CONFIG).map(([value, config]) => ({
  value,
  ...config,
}));

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

export const deepMerge = (target, source) => {
  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  const output = { ...target };
  Object.entries(source).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      output[key] = value.slice();
      return;
    }

    if (isObject(value) && isObject(output[key])) {
      output[key] = deepMerge(output[key], value);
      return;
    }

    output[key] = value;
  });
  return output;
};

export const inferDocumentKind = (file) => {
  const filename = file.name.toLowerCase();

  if (filename.endsWith('.csv')) {
    return 'bank_statement';
  }

  if (filename.endsWith('.json')) {
    return 'bureau_report';
  }

  if (filename.includes('gst')) {
    return 'gst_filing';
  }

  if (filename.includes('itr') || filename.includes('income') || filename.includes('financial')) {
    return 'itr_statement';
  }

  if (filename.includes('annual') || filename.includes('report')) {
    return 'annual_report';
  }

  return 'annual_report';
};

export const buildDocumentDraft = (file) => {
  const documentKind = inferDocumentKind(file);
  const config = DOCUMENT_KIND_CONFIG[documentKind];
  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    file,
    name: file.name,
    size: file.size,
    documentKind,
    channel: config.channel,
    backendType: config.backendType,
    status: 'queued',
    analysisId: null,
    extractedData: null,
    error: null,
  };
};

export const persistWorkflowInitialInput = (payload) => {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.setItem(WORKFLOW_INITIAL_INPUT_STORAGE_KEY, JSON.stringify(payload));
};

export const readWorkflowInitialInput = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = sessionStorage.getItem(WORKFLOW_INITIAL_INPUT_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const clearWorkflowInitialInput = () => {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.removeItem(WORKFLOW_INITIAL_INPUT_STORAGE_KEY);
};

export const persistIngestionSession = (payload) => {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.setItem(INGESTION_SESSION_STORAGE_KEY, JSON.stringify(payload));
};

export const readIngestionSession = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = sessionStorage.getItem(INGESTION_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const clearIngestionSession = () => {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.removeItem(INGESTION_SESSION_STORAGE_KEY);
};

const deriveFinancialStatementPatch = (documents) => {
  return documents
    .filter((document) => ['gst_filing', 'itr_statement', 'annual_report'].includes(document.documentKind))
    .reduce((accumulator, document) => deepMerge(accumulator, document.extractedData || {}), {});
};

const deriveBankStatementPatch = (documents) => {
  const bankDocument = documents.find((document) => document.documentKind === 'bank_statement');
  return bankDocument?.extractedData || {};
};

const deriveBureauPatch = (documents) => {
  const bureauDocument = documents.find((document) => document.documentKind === 'bureau_report');
  return bureauDocument?.extractedData || {};
};

export const buildWorkflowInitialInputFromDocuments = ({ documents, requestedAmount = 0, applicantName = '' }) => {
  const normalizedDocuments = documents.map((document) => ({
    id: document.id,
    name: document.name,
    documentKind: document.documentKind,
    channel: document.channel,
    backendType: document.backendType,
    analysisId: document.analysisId,
    extractedData: document.extractedData,
  }));

  const extracted = {
    financial_documents: deriveFinancialStatementPatch(documents),
    bank_statement: deriveBankStatementPatch(documents),
    bureau_report: deriveBureauPatch(documents),
  };

  return {
    analysis_source: 'databricks_ingestion',
    uploaded_at: new Date().toISOString(),
    applicant_name: applicantName,
    requested_amount: requestedAmount,
    documents: normalizedDocuments,
    extracted,
  };
};

export const deriveProposalPatchFromDocuments = (documents) => {
  const financial = deriveFinancialStatementPatch(documents);
  const bankStatement = deriveBankStatementPatch(documents);
  const bureau = deriveBureauPatch(documents);

  const currentAssets = Number(financial.current_assets || 0);
  const totalAssets = Number(financial.total_assets || 0);
  const totalLiabilities = Number(financial.total_liabilities || 0);
  const currentLiabilities = Number(financial.current_liabilities || 0);

  return {
    financials: {
      operating_income: Number(financial.revenue || 0),
      short_term_liab: currentLiabilities,
      long_term_liab: Math.max(totalLiabilities - currentLiabilities, 0),
      bureau_score: Number(bureau.bureau_score || 700),
      current_assets: currentAssets,
      fixed_assets: Math.max(totalAssets - currentAssets, 0),
    },
    facility: {
      amount: Number(bankStatement.total_credits || 0),
    },
  };
};

export const applyProposalPatch = (formData, patch) => ({
  ...formData,
  customer: deepMerge(formData.customer || {}, patch.customer || {}),
  financials: deepMerge(formData.financials || {}, patch.financials || {}),
  facility: deepMerge(formData.facility || {}, patch.facility || {}),
  writeup: deepMerge(formData.writeup || {}, patch.writeup || {}),
  exposure: deepMerge(formData.exposure || {}, patch.exposure || {}),
  approval: deepMerge(formData.approval || {}, patch.approval || {}),
});

export const buildResponseExpression = (path) => `{{ response.${path.split(' > ').join('.')} }}`;

export const setValueAtPath = (target, path, value) => {
  const segments = path.split('.').filter(Boolean);
  if (segments.length === 0) {
    return value;
  }

  const output = { ...(target || {}) };
  let cursor = output;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      cursor[segment] = value;
      return;
    }
    cursor[segment] = isObject(cursor[segment]) ? { ...cursor[segment] } : {};
    cursor = cursor[segment];
  });
  return output;
};
