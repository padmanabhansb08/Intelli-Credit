import { useState } from 'react';
import { RefreshCw, Activity } from 'lucide-react';

export default function ScenarioSimulator({ baseStressResult, currentDscr, pdScore }) {
    const [revenueShock, setRevenueShock] = useState(0);
    const [rateShock, setRateShock] = useState(0);

    // Simplified frontend recalculation for the slider interaction
    const simulatedDscr = currentDscr * (1 - (revenueShock / 100)) - (rateShock / 100 * 0.5);
    const simulatedPd = pdScore * (1 + (revenueShock / 100) * 1.5 + (rateShock / 100) * 0.5);
    const isSurviving = simulatedDscr > 1.0;

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-400">Revenue Shock (%)</span>
                        <span className="text-white font-mono">-{revenueShock}%</span>
                    </div>
                    <input
                        type="range" min="0" max="50" step="5"
                        value={revenueShock} onChange={(e) => setRevenueShock(Number(e.target.value))}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-400">Interest Rate Shock (bps)</span>
                        <span className="text-white font-mono">+{rateShock * 100} bps</span>
                    </div>
                    <input
                        type="range" min="0" max="5" step="0.5"
                        value={rateShock} onChange={(e) => setRateShock(Number(e.target.value))}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-[#0f172a] rounded-lg p-4 border border-slate-800">
                    <p className="text-xs text-slate-500 mb-1">Stressed DSCR</p>
                    <div className="flex items-end gap-2">
                        <span className={`text-2xl font-bold ${simulatedDscr < 1.0 ? 'text-red-400' : 'text-white'}`}>
                            {simulatedDscr.toFixed(2)}x
                        </span>
                        <span className="text-xs text-slate-500 mb-1">
                            (from {currentDscr.toFixed(2)}x)
                        </span>
                    </div>
                </div>

                <div className="bg-[#0f172a] rounded-lg p-4 border border-slate-800">
                    <p className="text-xs text-slate-500 mb-1">Stressed PD</p>
                    <div className="flex items-end gap-2">
                        <span className={`text-2xl font-bold ${simulatedPd > 0.5 ? 'text-red-400' : 'text-white'}`}>
                            {(simulatedPd * 100).toFixed(1)}%
                        </span>
                        <span className="text-xs text-slate-500 mb-1">
                            (from {(pdScore * 100).toFixed(1)}%)
                        </span>
                    </div>
                </div>
            </div>

            <div className={`p-4 rounded-lg flex items-center justify-between border ${isSurviving ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <div className="flex items-center gap-3">
                    <Activity className={`w-5 h-5 ${isSurviving ? 'text-emerald-400' : 'text-red-400'}`} />
                    <span className={`font-semibold ${isSurviving ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isSurviving ? 'Passes Stress Test' : 'Fails Stress Constraints'}
                    </span>
                </div>
                <button
                    onClick={() => { setRevenueShock(0); setRateShock(0) }}
                    className="text-slate-400 hover:text-white p-1"
                    title="Reset"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
