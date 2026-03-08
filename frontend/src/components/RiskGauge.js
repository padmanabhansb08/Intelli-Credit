import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function RiskGauge({ score, grade, label }) {
    // Score is 0-100, lower is better. We want the gauge to fill from left to right.
    const percentage = Math.max(0, Math.min(100, score));

    const data = [
        { name: 'Risk', value: percentage },
        { name: 'Safe', value: 100 - percentage },
    ];

    const getColor = (g) => {
        switch (g) {
            case 'A': return '#10B981'; // Green
            case 'B': return '#34D399'; // Light Green
            case 'C': return '#FBBF24'; // Yellow
            case 'D': return '#F87171'; // Red
            case 'E': return '#DC2626'; // Dark Red
            default: return '#3B82F6';
        }
    };

    const color = getColor(grade);

    return (
        <div className="flex flex-col items-center justify-center space-y-4">
            <div className="relative w-48 h-24 overflow-hidden">
                <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="100%"
                            startAngle={180}
                            endAngle={0}
                            innerRadius={70}
                            outerRadius={90}
                            paddingAngle={0}
                            dataKey="value"
                            stroke="none"
                            cornerRadius={4}
                        >
                            <Cell fill={color} />
                            <Cell fill="rgba(255,255,255,0.05)" />
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>

                {/* Value Display */}
                <div className="absolute bottom-0 w-full text-center">
                    <div className="flex items-end justify-center gap-1">
                        <span className="text-4xl font-black text-foreground">{percentage.toFixed(0)}</span>
                        <span className="text-sm text-muted-foreground mb-1">/100</span>
                    </div>
                </div>
            </div>

            <div className="text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border" style={{ backgroundColor: `${color}15`, borderColor: `${color}30` }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-sm font-bold" style={{ color }}>Grade {grade} - {label}</span>
                </div>
            </div>
        </div>
    );
}
