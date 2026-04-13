import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Unique ID generator
const genId = (prefix = 'prop') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// Seed data so the Review Station is not empty on first load
const SEED_PROPOSALS = [
  {
    id: 'prop_seed_1',
    company: 'Sample Corp 1',
    amount: '$1,500,000',
    status: 'Action Required',
    time: '2 hours ago',
    riskGrade: 'C',
    pdScore: '18.5%',
    pdTrend: '+2.1% MoM',
    pdIndustryAvg: '12.4%',
    lgdScore: '45%',
    lgdTrend: '-1.2% YoY',
    lgdIndustryAvg: '40%',
    eadTrend: '+5% QoQ',
    flaggedBy: 'Explainable AI Agent',
    reason: 'High DTI ratio > 45%',
    concentrationText: 'Concentration limit warning: Industry exposure at 14%',
    concentrationContext: 'Industry average limit is 10%. Previous quarter was 12.5%.',
    analysisResult: null,
    createdAt: Date.now() - 1000 * 60 * 120,
  },
  {
    id: 'prop_seed_2',
    company: 'Global Tech Solutions',
    amount: '$850,000',
    status: 'Review Needed',
    time: '4 hours ago',
    riskGrade: 'B',
    pdScore: '3.2%',
    pdTrend: '-0.5% MoM',
    pdIndustryAvg: '4.1%',
    lgdScore: '35%',
    lgdTrend: 'Stable',
    lgdIndustryAvg: '38%',
    eadTrend: '+2% QoQ',
    flaggedBy: 'IDP Node',
    reason: 'Incomplete KYC documentation',
    concentrationText: 'Missing beneficial ownership forms.',
    concentrationContext: 'Required for Tier 1 compliance. 98% of peers completed.',
    analysisResult: null,
    createdAt: Date.now() - 1000 * 60 * 240,
  },
];

const useAppStore = create(
  persist(
    (set, get) => ({
      // --- Proposal Queue (used by Review Station) ---
      proposals: SEED_PROPOSALS,

      // --- Active Dashboard Analysis ---
      activeAnalysisId: null,
      activeAnalysisResult: null,
      activeResearchNotes: '',

      // --- Actions ---

      /**
       * Called when an analysis is completed on the Dashboard.
       * Saves result globally and adds to the Review Queue if AI flags it.
       */
      setAnalysisResult: (result, analysisId) => {
        set({ activeAnalysisResult: result, activeAnalysisId: analysisId });

        // If analysis is flagged or rejected, auto-add it to the Review Queue
        const decision = result?.decision?.decision;
        if (decision && decision !== 'APPROVED') {
          const existing = get().proposals.find(p => p.id === analysisId);
          if (!existing) {
            const newProposal = {
              id: analysisId || genId(),
              company: 'New Submission',
              amount: `₹${(result?.decision?.summary?.recommended_limit || 0).toLocaleString()}`,
              status: decision === 'REJECTED' ? 'Critical Escalation' : 'Action Required',
              time: 'Just now',
              riskGrade: result?.composite_risk?.composite_score > 75 ? 'D' : 'C',
              pdScore: `${result?.composite_risk?.composite_score || 50}%`,
              pdTrend: '+2.0% MoM',
              pdIndustryAvg: '12.0%',
              lgdScore: '40%',
              lgdTrend: 'Stable',
              lgdIndustryAvg: '38%',
              eadTrend: '+5% QoQ',
              flaggedBy: 'AI Analysis Engine',
              reason: result?.decision?.comments || 'Model flagged for manual review',
              concentrationText: `Risk score: ${result?.composite_risk?.composite_score}. Exceeds threshold.`,
              concentrationContext: 'Auto-flagged by AI Analysis Engine for human review.',
              analysisResult: result,
              createdAt: Date.now(),
            };
            set({ proposals: [newProposal, ...get().proposals] });
          }
        }
      },

      setResearchNotes: (notes) => set({ activeResearchNotes: notes }),

      clearAnalysis: () => set({ activeAnalysisResult: null, activeAnalysisId: null, activeResearchNotes: '' }),

      /**
       * Called from the Decision Studio when a workflow is successfully deployed.
       * Adds a new pending proposal to the Review Queue.
       */
      addWorkflowProposal: (workflowData) => {
        const newProposal = {
          id: genId('wf'),
          company: workflowData.applicant_name || 'Studio Workflow Submission',
          amount: workflowData.requested_amount || 'N/A',
          status: 'Review Needed',
          time: 'Just now',
          riskGrade: 'B',
          pdScore: '5.0%',
          pdTrend: 'Stable',
          pdIndustryAvg: '8.0%',
          lgdScore: '30%',
          lgdTrend: 'Stable',
          lgdIndustryAvg: '35%',
          eadTrend: 'Stable',
          flaggedBy: 'Decision Studio',
          reason: `Workflow '${workflowData.workflow_name || 'Draft'}' completed. Awaiting review.`,
          concentrationText: 'Automated workflow submission awaiting credit officer review.',
          concentrationContext: 'Triggered from Decision Studio. No exceptions noted.',
          analysisResult: null,
          createdAt: Date.now(),
        };
        set({ proposals: [newProposal, ...get().proposals] });
      },

      /**
       * Remove a proposal from the Review Queue (Approve / Reject action)
       */
      resolveProposal: (proposalId) => {
        set({ proposals: get().proposals.filter(p => p.id !== proposalId) });
      },
    }),
    {
      name: 'intelli-credit-app-store', // persists to localStorage
      partialize: (state) => ({
        proposals: state.proposals,
        activeAnalysisResult: state.activeAnalysisResult,
        activeAnalysisId: state.activeAnalysisId,
        activeResearchNotes: state.activeResearchNotes,
      }),
    }
  )
);

export default useAppStore;
