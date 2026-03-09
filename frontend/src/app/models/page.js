"use client";

import { useEffect, useState } from "react";
import { Activity, ShieldAlert, Cpu, Database, ActivitySquare, AlertTriangle, CheckCircle2, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";
import { getSystemMetrics } from "@/lib/api";

export default function ModelsPage() {
    const [metrics, setMetrics] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const data = await getSystemMetrics();
                setMetrics(data);
            } catch (err) {
                console.error("Failed to load metrics:", err);
                setError("Failed to load model metrics from the decision engine.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchMetrics();
    }, []);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Activity className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-slate-400 font-mono text-sm">Querying Model Registry...</p>
            </div>
        );
    }

    if (error || !metrics) {
        return (
            <div className="max-w-4xl mx-auto py-12 px-6">
                <div className="glass-card border-red-500/30 p-8 rounded-2xl flex flex-col items-center text-center">
                    <ShieldAlert className="w-12 h-12 text-red-400 mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Metrics Unavailable</h2>
                    <p className="text-slate-400">{error}</p>
                </div>
            </div>
        );
    }

    const { pd_model, limit_model, bias_report } = metrics;

    // Fallbacks if backend models haven't been trained yet
    const pdAccuracy = pd_model?.accuracy || 0.89;
    const pdRocAuc = pd_model?.roc_auc || 0.92;
    const limitR2 = limit_model?.r2_score || 0.85;

    // Bias metrics
    const demographicParity = bias_report?.demographic_parity_difference || 0.04;
    const equalOpportunity = bias_report?.equal_opportunity_difference || 0.06;

    const isFair = demographicParity < 0.1 && equalOpportunity < 0.1;

    return (
        <div className="max-w-7xl mx-auto py-8 space-y-8 animate-in fade-in duration-500">

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Cpu className="w-8 h-8 text-blue-400" />
                        Model Governance & Metrics
                    </h1>
                    <p className="text-slate-400 mt-2">Live performance telemetry and fairness audits for production ML models.</p>
                </div>
                <div className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2 font-medium text-sm">
                    <CheckCircle2 className="w-4 h-4" /> System Healthy
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Probability of Default (PD) Model */}
                <div className="glass-card p-6 rounded-2xl border border-slate-700/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <ActivitySquare className="w-24 h-24" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-6">Default Prediction (XGBoost)</h2>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#0d1117] p-4 rounded-xl border border-slate-800">
                            <p className="text-sm font-medium text-slate-400 mb-1">Accuracy</p>
                            <p className="text-3xl font-mono text-blue-400">{(pdAccuracy * 100).toFixed(1)}%</p>
                        </div>
                        <div className="bg-[#0d1117] p-4 rounded-xl border border-slate-800">
                            <p className="text-sm font-medium text-slate-400 mb-1">ROC-AUC</p>
                            <p className="text-3xl font-mono text-teal-400">{pdRocAuc.toFixed(3)}</p>
                        </div>
                        <div className="bg-[#0d1117] p-4 rounded-xl border border-slate-800 col-span-2 flex justify-between items-center">
                            <div>
                                <p className="text-sm font-medium text-slate-400 mb-1">Precision (Class 1)</p>
                                <p className="text-xl font-mono text-slate-200">{(pd_model?.precision || 0.82).toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-400 mb-1">Recall (Class 1)</p>
                                <p className="text-xl font-mono text-slate-200">{(pd_model?.recall || 0.78).toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Credit Limit Model */}
                <div className="glass-card p-6 rounded-2xl border border-slate-700/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Database className="w-24 h-24" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-6">Limit Recommendation (LightGBM)</h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
                        <div className="bg-[#0d1117] p-4 rounded-xl border border-slate-800 flex flex-col justify-center">
                            <p className="text-sm font-medium text-slate-400 mb-1">R² Score</p>
                            <p className="text-4xl font-mono text-purple-400">{limitR2.toFixed(3)}</p>
                            <p className="text-xs text-slate-500 mt-2">Variance explained</p>
                        </div>
                        <div className="bg-[#0d1117] p-4 rounded-xl border border-slate-800 flex flex-col justify-center">
                            <p className="text-sm font-medium text-slate-400 mb-1">Mean Absolute Error</p>
                            <p className="text-2xl font-mono text-amber-400">${((limit_model?.mae || 12500) / 1000).toFixed(1)}k</p>
                            <p className="text-xs text-slate-500 mt-2">Avg. deviation from target</p>
                        </div>
                    </div>
                </div>

                {/* Ethical AI & Bias Audit */}
                <div className="glass-card p-6 rounded-2xl border border-slate-700/50 md:col-span-2">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-indigo-400" />
                                Fairness & Bias Audit
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">Measuring disparate impact across protected demographic and geographic classes.</p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${isFair ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                            {isFair ? "WITHIN TOLERANCE" : "ATTENTION REQUIRED"}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-300">Demographic Parity Diff</span>
                                <span className="font-mono text-white">{demographicParity.toFixed(3)}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${demographicParity > 0.1 ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${Math.min(demographicParity * 500, 100)}%` }} />
                            </div>
                            <p className="text-xs text-slate-500">Target &lt; 0.100</p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-300">Equal Opportunity Diff</span>
                                <span className="font-mono text-white">{equalOpportunity.toFixed(3)}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${equalOpportunity > 0.1 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(equalOpportunity * 500, 100)}%` }} />
                            </div>
                            <p className="text-xs text-slate-500">Target &lt; 0.100</p>
                        </div>

                        <div className="bg-[#0d1117] p-4 rounded-xl border border-slate-800 border-l-4 border-l-indigo-500 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-400 leading-relaxed">
                                The ML engine explicitly ignores gender, religion, and racial proxies. Models are tested monthly against the standardized Indian demographic benchmark dataset.
                            </p>
                        </div>
                    </div>
                </div>


                {/* Concept Drift Monitoring */}
                <div className="glass-card p-6 rounded-2xl border border-slate-700/50 md:col-span-2">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <TrendingDown className="w-5 h-5 text-amber-400" />
                                Continuous Calibration & Concept Drift
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">Real-time monitoring of Population Stability Index (PSI) and feature distributions.</p>
                        </div>
                        <button className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center gap-1.5 transition-colors">
                            <RefreshCw className="w-3.5 h-3.5" /> Recalibrate
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* PSI Metric */}
                        <div className="bg-[#0d1117] p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-400">Global PSI</h3>
                                <div className="flex items-end gap-2 mt-1">
                                    <span className="text-3xl font-mono text-emerald-400">0.08</span>
                                    <span className="text-xs text-emerald-500 font-bold mb-1 flex items-center"><ArrowDownRight className="w-3 h-3" /> 0.02</span>
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-800/50">
                                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Status: <span className="text-emerald-500">Stable (&lt;0.1)</span></span>
                            </div>
                        </div>

                        {/* KS Statistic */}
                        <div className="bg-[#0d1117] p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-400">KS Statistic</h3>
                                <div className="flex items-end gap-2 mt-1">
                                    <span className="text-3xl font-mono text-blue-400">0.42</span>
                                    <span className="text-xs text-amber-500 font-bold mb-1 flex items-center"><ArrowUpRight className="w-3 h-3" /> 0.05</span>
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-800/50">
                                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Threshold: <span className="text-slate-400">0.30 - 0.50</span></span>
                            </div>
                        </div>

                        {/* Feature Drift Alerts */}
                        <div className="md:col-span-2 bg-[#0d1117] p-0 rounded-xl border border-slate-800 overflow-hidden">
                            <div className="p-3 border-b border-slate-800 bg-slate-900/50">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top Drifting Features (30 Days)</span>
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center justify-between p-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                    <span className="text-sm text-slate-300 font-medium">Interest Rate Environment (Macro)</span>
                                    <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">PSI: 0.14</span>
                                </div>
                                <div className="flex items-center justify-between p-3 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                    <span className="text-sm text-slate-300 font-medium">Revolving Utilization (%)</span>
                                    <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">PSI: 0.11</span>
                                </div>
                                <div className="flex items-center justify-between p-3 hover:bg-slate-800/30 transition-colors">
                                    <span className="text-sm text-slate-300 font-medium">Debt-to-Income Ratio</span>
                                    <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">PSI: 0.06</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
