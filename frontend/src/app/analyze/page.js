"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  Download,
  FileText,
  Network,
  PieChart as PieChartIcon,
  ShieldCheck,
} from 'lucide-react';
import AnalysisSummary from '@/components/AnalysisSummary';
import AuditTrail from '@/components/AuditTrail';
import RiskGauge from '@/components/RiskGauge';
import ScenarioSimulator from '@/components/ScenarioSimulator';
import ShapChart from '@/components/ShapChart';
import { downloadCamPdf } from '@/lib/api';

const loadAnalysisResult = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = sessionStorage.getItem('analysisResult');
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to parse result', error);
    return null;
  }
};

export default function AnalyzePage() {
  const router = useRouter();
  const [result] = useState(loadAnalysisResult);
  const [isDownloadingCam, setIsDownloadingCam] = useState(false);

  useEffect(() => {
    if (!result) {
      router.replace('/');
    }
  }, [result, router]);

  if (!result) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Activity className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const {
    analysis_id,
    composite_risk,
    decision,
    features,
    stress_test,
    web_research,
    audit_trail,
  } = result;

  const handleDownload = async () => {
    setIsDownloadingCam(true);
    try {
      await downloadCamPdf(analysis_id);
    } catch (error) {
      console.error('Failed to download CAM PDF', error);
      window.alert(error.response?.data?.detail || error.message || 'Failed to download CAM PDF.');
    } finally {
      setIsDownloadingCam(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> New Analysis
        </button>
        <div className="flex gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-slate-400">
            ID: {analysis_id.split('-')[0]}
          </div>
        </div>
      </div>

      <AnalysisSummary result={result} onDownloadCam={handleDownload} isDownloadingCam={isDownloadingCam} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-blue-400" /> Composite Risk
                </h3>
              </div>
              <RiskGauge
                score={composite_risk.composite_score}
                grade={composite_risk.grade}
                label={composite_risk.grade_label}
              />
              <div className="pt-4 mt-6 border-t border-slate-800 text-center text-xs text-slate-500">
                Blend: Financial (25%) + PD (30%) + External Risk (45%)
              </div>
            </div>

            <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Network className="w-5 h-5 text-teal-400" /> Web Intelligence
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-sm text-slate-400">ESG Score</span>
                    <span className={`font-mono ${web_research.esg_score > 60 ? 'text-emerald-400' : 'text-amber-400'}`}>{web_research.esg_score}/100</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-sm text-slate-400">News Sentiment</span>
                    <span className="font-mono text-slate-200">{web_research.sentiment_score > 0 ? '+' : ''}{web_research.sentiment_score.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-sm text-slate-400">Litigation Exposure</span>
                    <span className={`text-xs px-2 py-1 rounded font-bold ${web_research.litigation_flag ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                      {web_research.litigation_flag ? 'DETECTED' : 'CLEAR'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Management Quality</span>
                    <span className="font-medium text-slate-200">{web_research.management_quality}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                Explainable AI (SHAP) - Key Risk Drivers
              </h3>
            </div>
            <ShapChart data={decision?.risk_factors || []} />
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card p-6 rounded-2xl border-blue-500/10 border">
            <h3 className="text-lg font-bold text-white mb-6">Scenario Simulator</h3>
            <ScenarioSimulator
              baseStressResult={stress_test}
              currentDscr={features.dscr}
              pdScore={decision.summary.pd_score}
            />
          </div>

          <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
              <FileText className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Full Credit Appraisal</h3>
              <p className="text-sm text-slate-400 mt-1">Structured narrative generated from model outputs</p>
            </div>
            <button
              onClick={handleDownload}
              disabled={isDownloadingCam}
              className="w-full py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium flex justify-center items-center gap-2 border border-slate-600 transition-colors disabled:opacity-60"
            >
              {isDownloadingCam ? <Activity className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isDownloadingCam ? 'Preparing PDF...' : 'Download Final PDF'}
            </button>
          </div>

          <div className="glass-card p-6 rounded-2xl h-[400px] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-6 sticky top-0 bg-[#151A23] pb-2 z-10 border-b border-slate-800">
              Governance Audit Log
            </h3>
            <AuditTrail trail={audit_trail} />
          </div>
        </div>
      </div>
    </div>
  );
}
