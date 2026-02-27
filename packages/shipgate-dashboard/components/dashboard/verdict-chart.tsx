'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const VERDICT_COLORS: Record<string, string> = {
  SHIP: '#00e68a',
  WARN: '#ffb547',
  NO_SHIP: '#ff5c6a',
  none: '#555566',
};

const VERDICT_LABELS: Record<string, string> = {
  SHIP: 'Ship',
  WARN: 'Warn',
  NO_SHIP: 'No Ship',
  none: 'No Verdict',
};

interface VerdictChartProps {
  breakdown: Record<string, number>;
}

export function VerdictChart({ breakdown }: VerdictChartProps) {
  const data = Object.entries(breakdown)
    .filter(([, count]) => count > 0)
    .map(([verdict, count]) => ({
      name: VERDICT_LABELS[verdict] ?? verdict,
      value: count,
      color: VERDICT_COLORS[verdict] ?? '#555566',
    }));

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-sg-text3">
        No verdict data yet
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <div className="w-[140px] h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={65}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#111118',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#c8c8d4',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-sg-text1">{entry.name}</span>
            <span className="text-xs font-mono text-sg-text0 ml-auto">
              {entry.value}
            </span>
            <span className="text-[10px] text-sg-text3 w-10 text-right">
              {((entry.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
