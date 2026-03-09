import { Activity, Download, ShieldAlert, ShieldCheck, Target } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function AnalysisSummary({ result, onDownloadCam, isDownloadingCam = false }) {
  const { decision, risk_premium, capital_impact } = result;

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
                <span className="text-warning mt-1 font-bold">•</span>
                {condition}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
