"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileBarChart,
  FileText,
  Map,
  Save,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import DocumentUploader from '@/components/DocumentUploader';
import {
  applyProposalPatch,
  buildWorkflowInitialInputFromDocuments,
  persistWorkflowInitialInput,
  readIngestionSession,
} from '@/lib/ingestion';
import { generateCamPdf, loadDraft, runAnalysis, saveDraft } from '@/lib/api';

const STEPS = [
  { id: 'initiation', label: '1. Initiation', icon: Building2 },
  { id: 'enrichment', label: '2. Enrichment', icon: Briefcase },
  { id: 'evaluation', label: '3. Evaluation & Approval', icon: ShieldCheck },
];

const ANALYSIS_STEPS = [
  {
    id: 'ingest',
    label: 'Ingesting Data',
    description: 'Document payloads and manual proposal inputs are being consolidated.',
  },
  {
    id: 'research',
    label: 'Web Research',
    description: 'The FastAPI pipeline is enriching the proposal with simulated diligence signals.',
  },
  {
    id: 'scoring',
    label: 'ML Scoring',
    description: 'Risk models are producing PD, limit, pricing, and decision outputs.',
  },
  {
    id: 'cam',
    label: 'CAM Generated',
    description: 'The credit appraisal memo is being prepared for download.',
  },
];

const createSubmissionSteps = () => ANALYSIS_STEPS.map((step) => ({
  ...step,
  status: 'pending',
  detail: null,
}));

const createAnalysisId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `LOS-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `LOS-${Math.random().toString(36).slice(2, 10)}`;
};

const defaultFormData = {
  customer: { name: '', id: '', industry: 'Manufacturing', constitution: 'Public Ltd' },
  financials: {
    operating_income: 0,
    non_operating_income: 0,
    short_term_liab: 0,
    long_term_liab: 0,
    contingent_liab: 0,
    internal_rating: '',
    external_rating: '',
    bureau_score: 700,
    current_assets: 0,
    fixed_assets: 0,
    intangible_assets: 0,
  },
  facility: { amount: 0, currency: 'INR', purpose: '', term_months: 12, repayment_method: 'EMI' },
  collateral_list: [],
  writeup: { swot: '', business_overview: '', policy_exceptions: '' },
  kyc_status: 'Pending',
  exposure: { internal: 0, external: 0, parent_child: 0, geography: 'Low', industry: 'Medium', entity: 'Low' },
  approval: { risk_dept: 'Pending', legal_dept: 'Pending', compliance: 'Pending' },
  remarks: [],
};

export default function NewProposalWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSteps, setSubmissionSteps] = useState(createSubmissionSteps);
  const [submissionError, setSubmissionError] = useState(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [analysisId, setAnalysisId] = useState(null);
  const [ingestionSession, setIngestionSession] = useState(null);

  useEffect(() => {
    const fetchDraft = async () => {
      const storedIngestion = readIngestionSession();
      if (storedIngestion) {
        setIngestionSession(storedIngestion);
        setAnalysisId(storedIngestion.analysisId || null);
        if (storedIngestion.proposalPatch) {
          setFormData((current) => applyProposalPatch(current, storedIngestion.proposalPatch));
        }
      }

      const draftId = sessionStorage.getItem('draftId');
      if (draftId) {
        try {
          const draftData = await loadDraft(draftId);
          if (draftData?.draft) {
            setFormData((current) => ({
              ...current,
              ...draftData.draft,
            }));
            setAnalysisId(draftId);
          }
        } catch (error) {
          console.error('Failed to load draft:', error);
        }
      }

      setIsLoadingDraft(false);
    };

    fetchDraft();
  }, []);

  const updateSubmissionStep = (stepId, patch) => {
    setSubmissionSteps((current) => current.map((step) => (
      step.id === stepId
        ? {
            ...step,
            ...patch,
          }
        : step
    )));
  };

  const updateNestedState = (section, field, value) => {
    setFormData((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  };

  const handleNext = () => setCurrentStep((current) => Math.min(current + 1, STEPS.length - 1));
  const handlePrev = () => setCurrentStep((current) => Math.max(current - 1, 0));

  const handleIngestionComplete = ({ analysisId: nextAnalysisId, documents, workflowInitialInput, proposalPatch }) => {
    setAnalysisId(nextAnalysisId);
    setIngestionSession({
      analysisId: nextAnalysisId,
      documents,
      workflowInitialInput,
      proposalPatch,
    });
    setFormData((current) => applyProposalPatch(current, proposalPatch));
    setSubmissionError(null);
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const draftId = sessionStorage.getItem('draftId') || analysisId || createAnalysisId();
      await saveDraft(draftId, formData);
      sessionStorage.setItem('draftId', draftId);
      setAnalysisId(draftId);
      window.alert('Draft saved successfully to the server.');
    } catch (error) {
      console.error(error);
      window.alert(`Failed to save draft: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmissionError(null);
    setSubmissionSteps(createSubmissionSteps());

    const nextAnalysisId = analysisId || createAnalysisId();
    setAnalysisId(nextAnalysisId);

    const fallbackWorkflowInput = ingestionSession?.workflowInitialInput || buildWorkflowInitialInputFromDocuments({
      documents: [],
      requestedAmount: formData.facility.amount,
      applicantName: formData.customer.name,
    });
    const workflowInitialInput = {
      ...fallbackWorkflowInput,
      applicant_name: formData.customer.name || fallbackWorkflowInput.applicant_name,
      requested_amount: formData.facility.amount || fallbackWorkflowInput.requested_amount,
    };
    persistWorkflowInitialInput(workflowInitialInput);

    try {
      updateSubmissionStep('ingest', {
        status: 'completed',
        detail: ingestionSession?.documents?.length
          ? `${ingestionSession.documents.length} uploaded document payload${ingestionSession.documents.length > 1 ? 's' : ''} attached to the run.`
          : 'Running from manual proposal data.',
      });
      updateSubmissionStep('research', {
        status: 'running',
        detail: 'Calling /api/analyze and waiting for enrichment to complete.',
      });

      const result = await runAnalysis(nextAnalysisId, formData);

      updateSubmissionStep('research', {
        status: 'completed',
        detail: 'External research and qualitative synthesis finished.',
      });
      updateSubmissionStep('scoring', {
        status: 'completed',
        detail: 'Probability of default, exposure, and pricing outputs are ready.',
      });
      updateSubmissionStep('cam', {
        status: 'running',
        detail: 'Calling /api/cam/generate to prepare the PDF artifact.',
      });

      await generateCamPdf(nextAnalysisId);

      updateSubmissionStep('cam', {
        status: 'completed',
        detail: 'CAM generated successfully. Redirecting to the analysis workspace.',
      });

      sessionStorage.setItem('analysisResult', JSON.stringify(result));
      sessionStorage.setItem('analysisId', nextAnalysisId);
      router.push('/analyze');
    } catch (error) {
      const message = error.response?.data?.detail || error.message || 'Failed to submit proposal.';
      console.error('Analysis Error:', error);
      setSubmissionError(message);
      setSubmissionSteps((current) => current.map((step) => (
        step.status === 'running'
          ? {
              ...step,
              status: 'failed',
              detail: message,
            }
          : step
      )));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    sessionStorage.removeItem('draftId');
    router.push('/');
  };

  const ingestionSummary = useMemo(() => {
    if (!ingestionSession?.documents?.length) {
      return null;
    }

    return `${ingestionSession.documents.length} uploaded document payload${ingestionSession.documents.length > 1 ? 's' : ''} synced to the workflow trigger.`;
  }, [ingestionSession?.documents]);

  if (isLoadingDraft) {
    return (
      <div className="flex flex-col items-center justify-center py-40 space-y-4 h-full min-h-[600px]">
        <Activity className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-slate-400 font-mono text-sm">Resuming Work in Progress...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans text-white tracking-tight">Credit Origination</h1>
          <p className="text-slate-400 mt-1">Multi-stage loan origination with Databricks ingestion and a workflow-ready trigger payload.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={isSaving || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition font-medium border border-slate-700 disabled:opacity-60"
          >
            {isSaving ? <Activity className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </button>
          <button onClick={handleCancel} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition font-medium border border-red-500/20">
            Cancel
          </button>
        </div>
      </div>

      <div className="flex w-full mb-8 relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-800 -z-10" />
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isPassed = index < currentStep;
          return (
            <div key={step.id} className="flex-1 flex flex-col items-center relative">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-[#0B0E14] transition-colors duration-300 ${isActive ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : isPassed ? 'bg-teal-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`mt-3 text-sm font-medium ${isActive ? 'text-blue-400' : isPassed ? 'text-teal-400' : 'text-slate-500'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex-1 glass-card rounded-2xl border border-slate-700/50 p-6 md:p-8 relative overflow-hidden min-h-[640px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {currentStep === 0 && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-400" /> Customer Details</h3>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Entity Name</label>
                      <input
                        type="text"
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                        placeholder="e.g. Reliance Industries Ltd."
                        value={formData.customer.name}
                        onChange={(event) => updateNestedState('customer', 'name', event.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Industry</label>
                        <select
                          className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                          value={formData.customer.industry}
                          onChange={(event) => updateNestedState('customer', 'industry', event.target.value)}
                        >
                          <option>Manufacturing</option>
                          <option>IT Services</option>
                          <option>Retail</option>
                          <option>Logistics</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Constitution</label>
                        <select
                          className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
                          value={formData.customer.constitution}
                          onChange={(event) => updateNestedState('customer', 'constitution', event.target.value)}
                        >
                          <option>Public Ltd</option>
                          <option>Private Ltd</option>
                          <option>LLP</option>
                          <option>Partnership</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2"><FileBarChart className="w-4 h-4 text-teal-400" /> Primary Financials</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Operating Income</label>
                        <input
                          type="number"
                          className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
                          value={formData.financials.operating_income}
                          onChange={(event) => updateNestedState('financials', 'operating_income', Number(event.target.value))}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Bureau Score</label>
                        <input
                          type="number"
                          className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
                          value={formData.financials.bureau_score}
                          onChange={(event) => updateNestedState('financials', 'bureau_score', Number(event.target.value))}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Current Assets</label>
                        <input
                          type="number"
                          className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
                          value={formData.financials.current_assets}
                          onChange={(event) => updateNestedState('financials', 'current_assets', Number(event.target.value))}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Fixed Assets</label>
                        <input
                          type="number"
                          className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
                          value={formData.financials.fixed_assets}
                          onChange={(event) => updateNestedState('financials', 'fixed_assets', Number(event.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4"><AlertCircle className="w-4 h-4 text-indigo-400" /> Facility Structuring</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Amount</label>
                      <input
                        type="number"
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
                        value={formData.facility.amount}
                        onChange={(event) => updateNestedState('facility', 'amount', Number(event.target.value))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 mb-1 block">Term (Months)</label>
                      <input
                        type="number"
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
                        value={formData.facility.term_months}
                        onChange={(event) => updateNestedState('facility', 'term_months', Number(event.target.value))}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-400 mb-1 block">Purpose of Facility</label>
                      <input
                        type="text"
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white"
                        placeholder="e.g. Working capital expansion"
                        value={formData.facility.purpose}
                        onChange={(event) => updateNestedState('facility', 'purpose', event.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-6 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2"><UploadCloud className="w-4 h-4 text-purple-400" /> Document Uploads</h3>
                      <p className="text-sm text-slate-400 mt-1">Databricks extraction results feed both the proposal form and the workflow trigger payload.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push('/studio')}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
                    >
                      Open Studio <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>

                  <DocumentUploader
                    applicantName={formData.customer.name}
                    requestedAmount={formData.facility.amount}
                    initialAnalysisId={analysisId}
                    onIngestionComplete={handleIngestionComplete}
                  />

                  {ingestionSummary && (
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                      {ingestionSummary}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2"><FileText className="w-4 h-4 text-amber-400" /> SWOT & Writeup</h3>
                      <p className="text-xs text-slate-400 mb-3">Qualitative notes flow into the risk premium and governance trail.</p>
                      <textarea
                        className="w-full h-32 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500 resize-none"
                        placeholder="Enter business overview, strengths, and mitigants..."
                        value={formData.writeup.swot}
                        onChange={(event) => updateNestedState('writeup', 'swot', event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-white mb-2 block">Policy Exceptions</label>
                      <textarea
                        className="w-full h-20 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 resize-none"
                        placeholder="List deviations from standard credit policy and justification."
                        value={formData.writeup.policy_exceptions}
                        onChange={(event) => updateNestedState('writeup', 'policy_exceptions', event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4"><Map className="w-4 h-4 text-emerald-400" /> Exposure & Concentration</h3>
                      <div className="space-y-4">
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                          <span className="text-slate-300 font-medium">Internal Bank Exposure</span>
                          <input
                            type="number"
                            className="w-32 bg-transparent border-b border-slate-700 text-white text-right focus:outline-none"
                            value={formData.exposure.internal}
                            onChange={(event) => updateNestedState('exposure', 'internal', Number(event.target.value))}
                          />
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                          <span className="text-slate-300 font-medium">External Exposure</span>
                          <input
                            type="number"
                            className="w-32 bg-transparent border-b border-slate-700 text-white text-right focus:outline-none"
                            value={formData.exposure.external}
                            onChange={(event) => updateNestedState('exposure', 'external', Number(event.target.value))}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Geography Risk</label>
                            <select
                              className="w-full bg-black border border-slate-700 rounded p-2 text-sm text-white"
                              value={formData.exposure.geography}
                              onChange={(event) => updateNestedState('exposure', 'geography', event.target.value)}
                            >
                              <option>Low</option>
                              <option>Medium</option>
                              <option>High</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Industry Concentration</label>
                            <select
                              className="w-full bg-black border border-slate-700 rounded p-2 text-sm text-white"
                              value={formData.exposure.industry}
                              onChange={(event) => updateNestedState('exposure', 'industry', event.target.value)}
                            >
                              <option>Low</option>
                              <option>Medium</option>
                              <option>High</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-8">
                <div className="flex flex-col items-center justify-center text-center space-y-6 pt-6">
                  <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/30">
                    <ShieldCheck className="w-10 h-10 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Ready for Autonomous Evaluation</h2>
                    <p className="text-slate-400 max-w-2xl mx-auto">
                      Submitting calls the live `/api/analyze` endpoint and then `/api/cam/generate` to verify the CAM artifact before redirecting to the analysis workspace.
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 text-left space-y-4">
                    <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">Pre-Submission Summary</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Borrower</span>
                      <span className="font-medium text-white">{formData.customer.name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Requested Limit</span>
                      <span className="font-mono text-emerald-400 font-bold">{formData.facility.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Trigger Payload</span>
                      <span className="text-blue-300 font-medium">{ingestionSession?.documents?.length ? `${ingestionSession.documents.length} files` : 'Manual only'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">KYC Status</span>
                      <span className="text-amber-400 font-medium">{formData.kyc_status}</span>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-800 bg-slate-950/60 p-6 space-y-4">
                    <div className="flex items-center gap-2 text-white">
                      <Sparkles className="w-4 h-4 text-cyan-300" />
                      <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-300">Execution Stepper</h4>
                    </div>
                    <div className="space-y-3">
                      {submissionSteps.map((step, index) => {
                        const isCompleted = step.status === 'completed';
                        const isRunning = step.status === 'running';
                        const isFailed = step.status === 'failed';
                        return (
                          <div key={step.id} className={`rounded-2xl border px-4 py-3 ${isCompleted ? 'border-emerald-400/30 bg-emerald-500/10' : isRunning ? 'border-cyan-400/30 bg-cyan-500/10' : isFailed ? 'border-rose-400/30 bg-rose-500/10' : 'border-slate-800 bg-slate-900/40'}`}>
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isCompleted ? 'bg-emerald-400/20 text-emerald-100' : isRunning ? 'bg-cyan-400/20 text-cyan-100' : isFailed ? 'bg-rose-400/20 text-rose-100' : 'bg-slate-800 text-slate-400'}`}>
                                {isRunning ? <Activity className="w-4 h-4 animate-spin" /> : index + 1}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-white">{step.label}</p>
                                <p className={`text-xs mt-1 ${isFailed ? 'text-rose-200' : 'text-slate-400'}`}>{step.detail || step.description}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {submissionError && (
                      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                        {submissionError}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-between items-center mt-6 pt-6 border-t border-slate-800">
        <button
          onClick={handlePrev}
          disabled={currentStep === 0 || isSubmitting}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${currentStep === 0 ? 'opacity-0 cursor-default' : 'bg-slate-800 text-white hover:bg-slate-700'} ${isSubmitting ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <ChevronLeft className="w-5 h-5" /> Back
        </button>

        {currentStep < STEPS.length - 1 ? (
          <button
            onClick={handleNext}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-500/25 disabled:opacity-60"
          >
            Next Stage <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-60"
          >
            {isSubmitting ? <Activity className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
            Submit for Evaluation
          </button>
        )}
      </div>
    </div>
  );
}
