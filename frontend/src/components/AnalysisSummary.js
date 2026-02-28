import { ShieldAlert, ShieldCheck, Download, BarChart2, Briefcase, Activity, Target } from "lucide-react";

export default function AnalysisSummary({ config, result, onDownloadCam }) {
    const { decision, risk_premium, capital_impact, features } = result;

    const isApproved = decision.decision === "APPROVE";
    const isConditional = decision.decision === "CONDITIONAL";

    const decisionColor = isApproved ? "text-emerald-400" : isConditional ? "text-amber-400" : "text-red-400";
    const decisionBg = isApproved ? "bg-emerald-500/10 border-emerald-500/20" : isConditional ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20";

    return (
        <div className="space-y-6">
            <div className={`glass-card rounded-2xl p-8 border-2 ${decisionBg} relative overflow-hidden`}>
                {/* Animated Decision Background Glow */}
                <div className={`absolute -inset-2 opacity-50 blur-2xl ${isApproved ? 'bg-emerald-500/20' : isConditional ? 'bg-amber-500/20' : 'bg-red-500/20'} pointer-events-none animate-pulse-glow`} />

                <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            {isApproved ? <ShieldCheck className="w-6 h-6 text-emerald-400" /> : <ShieldAlert className={`w-6 h-6 ${decisionColor}`} />}
                            <h2 className="text-sm font-bold tracking-widest text-slate-400 uppercase">AI Recommendation</h2>
                        </div>
                        <h1 className={`text-4xl md:text-5xl font-black ${decisionColor} tracking-tight`}>
                            {decision.decision}
                        </h1>
                        <p className="text-slate-300 mt-4 max-w-xl text-lg leading-relaxed">
                            {decision.reasoning[0]}
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 min-w-[200px]">
                        <button
                            onClick={onDownloadCam}
                            className="px-6 py-3 rounded-xl font-bold bg-white text-slate-900 hover:bg-blue-50 transition flex items-center justify-center gap-2 shadow-xl shadow-white/5"
                        >
                            <Download className="w-5 h-5" />
                            Download CAM PDF
                        </button>
                        <div className="text-center text-xs text-slate-500 flex justify-center items-center gap-1">
                            <Activity className="w-3 h-3" /> Fully automated generation
                        </div>
                    </div>
                </div>

                {/* Key Metrics Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-white/10">
                    <div>
                        <p className="text-sm text-slate-400 mb-1">Recommended Limit</p>
                        <p className="text-2xl font-bold text-white">${decision.summary.recommended_limit.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-400 mb-1">Pricing (Rate / Premium)</p>
                        <p className="text-2xl font-bold text-white">{(risk_premium.total_rate * 100).toFixed(2)}%</p>
                        <p className="text-xs text-blue-400">+{risk_premium.total_rate_bps} bps spread</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-400 mb-1">Probability of Default</p>
                        <p className={`text-2xl font-bold ${decision.summary.pd_score > 0.05 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {(decision.summary.pd_score * 100).toFixed(2)}%
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-400 mb-1">Capital Impact (RAROC)</p>
                        <p className={`text-2xl font-bold ${capital_impact.raroc > 15 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {capital_impact.raroc.toFixed(1)}%
                        </p>
                    </div>
                </div>
            </div>

            {decision.conditions?.length > 0 && (
                <div className="glass-panel p-6 rounded-2xl border-amber-500/20 bg-amber-500/5">
                    <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 mb-4 uppercase tracking-wider">
                        <Target className="w-4 h-4" /> Conditions for Approval
                    </h3>
                    <ul className="space-y-2">
                        {decision.conditions.map((cond, i) => (
                            <li key={i} className="flex gap-3 text-slate-300">
                                <span className="text-amber-500 mt-1">•</span>
                                {cond}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
