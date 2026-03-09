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
                        <span className="text-muted-foreground font-semibold">Revenue Shock (%)</span>
                        <span className="text-foreground font-mono font-bold">-{revenueShock}%</span>
                    </div>
                    <input
                        type="range" min="0" max="50" step="5"
                        value={revenueShock} onChange={(e) => setRevenueShock(Number(e.target.value))}
                        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                </div>

                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground font-semibold">Interest Rate Shock (bps)</span>
                        <span className="text-foreground font-mono font-bold">+{rateShock * 100} bps</span>
                    </div>
                    <input
                        type="range" min="0" max="5" step="0.5"
                        value={rateShock} onChange={(e) => setRateShock(Number(e.target.value))}
                        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-warning"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-background rounded-lg p-4 border border-border shadow-inner">
                    <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Stressed DSCR</p>
                    <div className="flex items-end gap-2">
                        <span className={`text-2xl font-black tracking-tight ${simulatedDscr < 1.0 ? 'text-destructive' : 'text-foreground'}`}>
                            {simulatedDscr.toFixed(2)}x
                        </span>
                        <span className="text-xs text-muted-foreground font-medium mb-1">
                            (from {currentDscr.toFixed(2)}x)
                        </span>
                    </div>
                </div>

                <div className="bg-background rounded-lg p-4 border border-border shadow-inner">
                    <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Stressed PD</p>
                    <div className="flex items-end gap-2">
                        <span className={`text-2xl font-black tracking-tight ${simulatedPd > 0.5 ? 'text-destructive' : 'text-foreground'}`}>
                            {(simulatedPd * 100).toFixed(1)}%
                        </span>
                        <span className="text-xs text-muted-foreground font-medium mb-1">
                            (from {(pdScore * 100).toFixed(1)}%)
                        </span>
                    </div>
                </div>
            </div>

            <div className={`p-4 rounded-lg flex items-center justify-between border ${isSurviving ? 'bg-success/10 border-success/20' : 'bg-destructive/10 border-destructive/20'}`}>
                <div className="flex items-center gap-3">
                    <Activity className={`w-5 h-5 ${isSurviving ? 'text-success' : 'text-destructive'}`} />
                    <span className={`font-semibold ${isSurviving ? 'text-success' : 'text-destructive'}`}>
                        {isSurviving ? 'Passes Stress Test' : 'Fails Stress Constraints'}
                    </span>
                </div>
                <button
                    onClick={() => { setRevenueShock(0); setRateShock(0) }}
                    className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                    title="Reset"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
