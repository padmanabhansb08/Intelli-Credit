import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const impactIncreasesRisk = (impact) => {
  if (!impact) {
    return false;
  }

  const normalized = String(impact);
  return normalized.includes('↑') || normalized.includes('â†‘') || normalized.toLowerCase().includes('increase');
};

function CustomTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = payload[0].payload;
  const isRiskIncrease = impactIncreasesRisk(point.impact);

  return (
    <div className="bg-card border border-border p-3 rounded-lg shadow-xl">
      <p className="text-sm font-bold text-foreground mb-1">{point.name}</p>
      <p className={`text-xs font-bold ${isRiskIncrease ? 'text-destructive' : 'text-success'}`}>
        SHAP Value: {point.value > 0 ? '+' : ''}{point.displayValue}
      </p>
      <p className="text-xs text-muted-foreground mt-1 font-medium">
        {isRiskIncrease ? 'Increases default probability' : 'Decreases default probability'}
      </p>
    </div>
  );
}

export default function ShapChart({ data }) {
  if (!data || data.length === 0) {
    return <div className="text-muted-foreground text-sm font-medium">No explainability data available.</div>;
  }

  const chartData = data.map((item) => {
    const isRiskIncrease = impactIncreasesRisk(item.impact);
    return {
      name: item.factor,
      value: isRiskIncrease ? item.importance : -item.importance,
      displayValue: Number(item.importance || 0).toFixed(3),
      impact: item.impact,
    };
  });

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
            tick={{ fill: 'currentColor', fontSize: 12, className: 'font-medium text-muted-foreground' }}
            width={120}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <ReferenceLine x={0} stroke="currentColor" className="text-border" />
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
