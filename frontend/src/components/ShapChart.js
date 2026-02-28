import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

export default function ShapChart({ data }) {
    if (!data || data.length === 0) return <div className="text-slate-500 text-sm">No explainability data available.</div>;

    const chartData = data.map(item => ({
        name: item.factor,
        value: item.impact === '↑ Risk' ? item.importance : -item.importance,
        displayValue: item.importance.toFixed(3),
        impact: item.impact,
    }));

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const isRiskIncr = data.impact === '↑ Risk';
            return (
                <div className="bg-[#1e293b] border border-slate-700 p-3 rounded-lg shadow-xl">
                    <p className="text-sm font-bold text-white mb-1">{data.name}</p>
                    <p className={`text-xs font-medium ${isRiskIncr ? 'text-red-400' : 'text-emerald-400'}`}>
                        SHAP Value: {data.value > 0 ? '+' : ''}{data.displayValue}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{isRiskIncr ? 'Increases Default Probability' : 'Decreases Default Probability'}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                    <XAxis type="number" hide />
                    <YAxis
                        dataKey="name"
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 12, className: 'font-medium' }}
                        width={120}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                    <ReferenceLine x={0} stroke="#334155" />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#ef4444' : '#10b981'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
