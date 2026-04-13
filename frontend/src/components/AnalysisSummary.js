import { useState } from 'react';
import { Activity, Download, ShieldAlert, ShieldCheck, Target, ChevronDown, ChevronUp, ExternalLink, AlertTriangle, FileText } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function AnalysisSummary({ result, onDownloadCam, isDownloadingCam = false }) {
  const [isExplainOpen, setIsExplainOpen] = useState(false);
  const { decision, risk_premium, capital_impact, composite_risk, web_research, features } = result;

  const reasoningMatrix = composite_risk?.reasoning_matrix || decision?.reasoning_matrix || [];
  const ncltFlag = web_research?.nclt_flag || features?.nclt_flag || false;
  const sourceUrls = web_research?.source_urls || [];

  const isApproved = decision.decision === 'APPROVE';
  const isConditional = decision.decision === 'CONDITIONAL';

  const decisionColor = isApproved ? 'text-success' : isConditional ? 'text-warning' : 'text-destructive';
  const decisionBg = isApproved ? 'bg-success/5 border-success/20' : isConditional ? 'bg-warning/5 border-warning/20' : 'bg-destructive/5 border-destructive/20';

  return (
    <div className="space-y-6">
      <Card className={`p-8 border-2 ${decisionBg} relative overflow-hidden shadow-sm`}>
        <div className={`absolute -inset-2 opacity-30 blur-2xl pointer-events-none animate-pulse-glow ${isApproved ? 'bg-success/20' : isConditional ? 'bg-warning/20' : 'bg-destructive/20'}`} />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {isApproved ? <ShieldCheck className="w-6 h-6 text-success" /> : <ShieldAlert className={`w-6 h-6 ${decisionColor}`} />}
              <h2 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">AI Recommendation</h2>
            </div>
            <h1 className={`text-4xl md:text-5xl font-black ${decisionColor} tracking-tight`}>
              {decision.decision}
            </h1>
            <p className="text-foreground/80 mt-4 max-w-xl text-lg leading-relaxed font-medium">
              {decision.reasoning[0]}
            </p>
          </div>

          <div className="flex flex-col gap-3 min-w-[200px]">
            <Button
              onClick={onDownloadCam}
              disabled={isDownloadingCam}
              className="px-6 py-6 font-bold shadow-xl flex items-center justify-center gap-2 text-md transition-all"
            >
              {isDownloadingCam ? <Activity className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              {isDownloadingCam ? 'Preparing CAM...' : 'Download CAM PDF'}
            </Button>
            <div className="text-center text-xs text-muted-foreground flex justify-center items-center gap-1 font-semibold">
              <Activity className="w-3 h-3" /> Fully automated generation
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-border/50">
          <div>
            <p className="text-sm text-muted-foreground font-semibold mb-1">Recommended Limit</p>
            <p className="text-2xl font-bold text-foreground">${decision.summary.recommended_limit.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-semibold mb-1">Pricing (Rate / Premium)</p>
            <p className="text-2xl font-bold text-foreground">{(risk_premium.total_rate * 100).toFixed(2)}%</p>
            <p className="text-xs text-primary font-medium">+{risk_premium.total_rate_bps} bps spread</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-semibold mb-1">Probability of Default</p>
            <p className={`text-2xl font-bold ${decision.summary.pd_score > 0.05 ? 'text-warning' : 'text-success'}`}>
              {(decision.summary.pd_score * 100).toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-semibold mb-1">Capital Impact (RAROC)</p>
            <p className={`text-2xl font-bold ${capital_impact.raroc > 15 ? 'text-success' : 'text-destructive'}`}>
              {capital_impact.raroc.toFixed(1)}%
            </p>
          </div>
        </div>
      </Card>

      {decision.conditions?.length > 0 && (
        <Card className="p-6 border-warning/20 bg-warning/5 shadow-sm">
          <h3 className="text-sm font-bold text-warning flex items-center gap-2 mb-4 uppercase tracking-wider">
            <Target className="w-4 h-4" /> Conditions for Approval
          </h3>
          <ul className="space-y-2">
            {decision.conditions.map((condition, index) => (
              <li key={index} className="flex gap-3 text-foreground font-medium">
                <span className="text-warning mt-1 font-bold">�</span>
                {condition}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Due Diligence & OSINT Card */}
      <Card className="p-6 border-primary/20 bg-card shadow-sm">
        <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-4 uppercase tracking-wider">
          <AlertTriangle className="w-4 h-4" /> OSINT Due Diligence
        </h3>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-border/50 rounded-lg p-4 bg-muted/20">
          <div>
            <p className="text-sm text-muted-foreground font-semibold mb-1">NCLT / IBC Insolvency Status</p>
            <div className="flex items-center gap-2">
              {ncltFlag ? (
                <span className="px-3 py-1 rounded-full bg-destructive/10 text-destructive text-sm font-bold flex items-center gap-1">
                  <ShieldAlert className="w-4 h-4" /> High Risk Detected
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-success/10 text-success text-sm font-bold flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> Clear
                </span>
              )}
            </div>
          </div>
          {sourceUrls.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground font-semibold">Verified Source Links (Tavily AI)</p>
              <div className="flex flex-wrap gap-2">
                {sourceUrls.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 bg-background border border-border/50 rounded hover:border-primary hover:text-primary transition-colors text-xs font-semibold"
                  >
                    <ExternalLink className="w-3 h-3" /> Source {idx + 1}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Explainability Panel (Deterministic 5 Cs) */}
      {reasoningMatrix.length > 0 && (
        <Card className="p-0 border-border/50 bg-card shadow-sm overflow-hidden">
          <button
            onClick={() => setIsExplainOpen(!isExplainOpen)}
            className="w-full flex items-center justify-between p-6 hover:bg-muted/50 transition-colors focus:outline-none"
          >
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
              <FileText className="w-4 h-4 text-primary" /> Deterministic Scoring Explainability
            </h3>
            {isExplainOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
          </button>

          {isExplainOpen && (
            <div className="p-6 pt-0 border-t border-border/50 bg-muted/10">
              <div className="space-y-3 mt-4">
                {reasoningMatrix.map((reason, index) => {
                  const isPenalty = reason.includes("Penalty");
                  const isFinal = reason.includes("Final Composite");
                  return (
                    <div
                      key={index}
                      className={`p-3 rounded-md border text-sm font-medium leading-relaxed ${isPenalty ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                          isFinal ? 'bg-primary/10 border-primary/20 text-primary font-bold' :
                            'bg-background border-border/50 text-foreground/80'
                        }`}
                    >
                      {reason}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
