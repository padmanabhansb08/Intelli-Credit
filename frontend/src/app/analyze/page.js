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
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

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
        <Activity className="w-8 h-8 text-primary animate-spin" />
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
    <div className="max-w-7xl mx-auto pb-20 space-y-8 animate-in mt-12 fade-in duration-700">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> New Analysis
        </button>
        <div className="flex gap-3">
          <Badge variant="secondary" className="font-mono shadow-sm">
            ID: {analysis_id.split('-')[0]}
          </Badge>
        </div>
      </div>

      <AnalysisSummary result={result} onDownloadCam={handleDownload} isDownloadingCam={isDownloadingCam} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="flex flex-col justify-between shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-primary" /> Composite Risk
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center">
                <RiskGauge
                  score={composite_risk.composite_score}
                  grade={composite_risk.grade}
                  label={composite_risk.grade_label}
                />
              </CardContent>
              <CardFooter className="pt-4 border-t border-border/50 text-center text-xs text-muted-foreground justify-center">
                Blend: Financial (25%) + PD (30%) + External Risk (45%)
              </CardFooter>
            </Card>

            <Card className="flex flex-col justify-between shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="w-5 h-5 text-indigo-500" /> Web Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-border/50">
                  <span className="text-sm text-muted-foreground font-semibold">ESG Score</span>
                  <span className={`font-mono font-bold ${web_research.esg_score > 60 ? 'text-success' : 'text-warning'}`}>{web_research.esg_score}/100</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-border/50">
                  <span className="text-sm text-muted-foreground font-semibold">News Sentiment</span>
                  <span className="font-mono font-bold text-foreground">{web_research.sentiment_score > 0 ? '+' : ''}{web_research.sentiment_score.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-border/50">
                  <span className="text-sm text-muted-foreground font-semibold">Litigation Exposure</span>
                  <Badge variant={web_research.litigation_flag ? 'destructive' : 'success'} className="text-[10px]">
                    {web_research.litigation_flag ? 'DETECTED' : 'CLEAR'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground font-semibold">Management Quality</span>
                  <span className="font-semibold text-foreground">{web_research.management_quality}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Explainable AI (SHAP) - Key Risk Drivers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ShapChart data={decision?.risk_factors || []} />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="shadow-sm border-primary/20">
            <CardHeader>
              <CardTitle>Scenario Simulator</CardTitle>
            </CardHeader>
            <CardContent>
              <ScenarioSimulator
                baseStressResult={stress_test}
                currentDscr={features.dscr}
                pdScore={decision.summary.pd_score}
              />
            </CardContent>
          </Card>

          <Card className="flex flex-col items-center justify-center text-center space-y-4 shadow-sm bg-primary/5 border-primary/10">
            <CardContent className="pt-6 pb-6 w-full flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20 shadow-sm">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Full Credit Appraisal</CardTitle>
                <CardDescription className="mt-1">Structured narrative generated from model outputs</CardDescription>
              </div>
              <Button
                onClick={handleDownload}
                disabled={isDownloadingCam}
                className="w-full mt-4 flex justify-center items-center gap-2 transition-all"
              >
                {isDownloadingCam ? <Activity className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isDownloadingCam ? 'Preparing PDF...' : 'Download Final PDF'}
              </Button>
            </CardContent>
          </Card>

          <Card className="h-[400px] overflow-hidden flex flex-col shadow-sm">
            <CardHeader className="pb-3 border-b border-border bg-card z-10 sticky top-0">
              <CardTitle>Governance Audit Log</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pt-4 pb-4">
              <AuditTrail trail={audit_trail} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
