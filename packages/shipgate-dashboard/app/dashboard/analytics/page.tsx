'use client';

import { useOverview, useFindingsBreakdown } from '@/hooks/use-data';
import { CardSkeleton, TableSkeleton } from '@/components/shared/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { RingChart } from '@/components/shared/ring-chart';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';

function verdictColor(verdict: string | null): string {
  switch (verdict) {
    case 'SHIP': return '#00e68a';
    case 'WARN': return '#ffb547';
    case 'NO_SHIP': return '#ff5c6a';
    default: return '#555566';
  }
}

function severityColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'critical': return '#ff5c6a';
    case 'high': return '#ffb547';
    case 'medium': return '#6366f1';
    default: return '#8888a0';
  }
}

export default function AnalyticsPage() {
  const { data: overview, isLoading: overviewLoading, error: overviewError, refetch: refetchOverview } = useOverview();
  const { data: findingsBreakdown, isLoading: findingsLoading } = useFindingsBreakdown(undefined, 'severity');
  const { data: categoryBreakdown } = useFindingsBreakdown(undefined, 'category');

  const isLoading = overviewLoading || findingsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Analytics</h1>
          <p className="text-sg-text2 text-sm">Verification trends and insights</p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CardSkeleton /><CardSkeleton />
        </div>
      </div>
    );
  }

  if (overviewError || !overview) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Analytics</h1>
          <p className="text-sg-text2 text-sm">Verification trends and insights</p>
        </div>
        <ErrorState message={overviewError ?? 'Failed to load analytics'} onRetry={refetchOverview} />
      </div>
    );
  }

  const trendData = [...overview.trend].reverse().map((t, i) => ({
    index: i,
    date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: t.score != null ? Math.round(t.score * 100) : null,
    verdict: t.verdict,
  }));

  const verdictCounts = overview.verdictBreakdown;
  const verdictChartData = Object.entries(verdictCounts).map(([verdict, count]) => ({
    name: verdict,
    value: count,
    color: verdictColor(verdict),
  }));

  const severityChartData = (findingsBreakdown ?? []).map((s) => ({
    name: s.key,
    count: s.count,
    color: severityColor(s.key),
  }));

  const categoryChartData = (categoryBreakdown ?? [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const shipCount = verdictCounts['SHIP'] ?? 0;
  const warnCount = verdictCounts['WARN'] ?? 0;
  const noShipCount = verdictCounts['NO_SHIP'] ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Analytics</h1>
        <p className="text-sg-text2 text-sm">Verification trends and insights</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Runs" value={overview.totalRuns} />
        <StatCard label="Ship Rate" value={`${overview.shipRate}%`} color={overview.shipRate >= 70 ? '#00e68a' : '#ff5c6a'} />
        <StatCard label="Total Findings" value={overview.totalFindings} />
        <StatCard label="Projects" value={overview.projectCount} />
      </div>

      {/* Verdict breakdown + Score trend */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Verdict breakdown */}
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-5">
          <h3 className="text-sm font-semibold text-sg-text0 mb-4">Verdict Breakdown</h3>
          <div className="flex items-center gap-6">
            <RingChart value={overview.shipRate} size={100} stroke={8} color="#00e68a">
              <div className="text-center">
                <span className="text-lg font-bold text-sg-text0">{overview.shipRate}%</span>
                <span className="block text-[10px] text-sg-text3">ship rate</span>
              </div>
            </RingChart>
            <div className="flex-1 space-y-3">
              <VerdictBar label="SHIP" count={shipCount} total={overview.totalRuns} color="#00e68a" />
              <VerdictBar label="WARN" count={warnCount} total={overview.totalRuns} color="#ffb547" />
              <VerdictBar label="NO_SHIP" count={noShipCount} total={overview.totalRuns} color="#ff5c6a" />
            </div>
          </div>
        </div>

        {/* Score trend */}
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-5">
          <h3 className="text-sm font-semibold text-sg-text0 mb-4">Score Trend</h3>
          {trendData.length > 1 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#8888a0', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#8888a0', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    background: '#111118',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#c8c8d4',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Score']}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#scoreGrad)"
                  dot={false}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-sg-text3 text-center py-8">
              Run more scans to see score trends
            </p>
          )}
        </div>
      </div>

      {/* Severity breakdown + Top categories */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Severity */}
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-5">
          <h3 className="text-sm font-semibold text-sg-text0 mb-4">Findings by Severity</h3>
          {severityChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={severityChartData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#8888a0', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#8888a0', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    background: '#111118',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#c8c8d4',
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {severityChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-sg-text3 text-center py-8">No findings yet</p>
          )}
        </div>

        {/* Top categories */}
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-5">
          <h3 className="text-sm font-semibold text-sg-text0 mb-4">Top Finding Categories</h3>
          {categoryChartData.length > 0 ? (
            <div className="space-y-2">
              {categoryChartData.map((cat) => {
                const maxCount = categoryChartData[0]?.count ?? 1;
                const pct = Math.round((cat.count / maxCount) * 100);
                return (
                  <div key={cat.key} className="flex items-center gap-3">
                    <span className="text-xs text-sg-text1 w-32 truncate" title={cat.key}>
                      {cat.key}
                    </span>
                    <div className="flex-1 h-2 bg-sg-bg3 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sg-accent rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-sg-text2 w-8 text-right">{cat.count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-sg-text3 text-center py-8">No findings yet</p>
          )}
        </div>
      </div>

      {/* Verdict timeline */}
      {trendData.length > 0 && (
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-5">
          <h3 className="text-sm font-semibold text-sg-text0 mb-4">Recent Run Timeline</h3>
          <div className="flex items-end gap-0.5" style={{ height: 48 }}>
            {trendData.map((d, i) => (
              <div
                key={i}
                className="flex-1 rounded-t transition-all hover:opacity-80"
                style={{
                  height: d.score != null ? `${Math.max(d.score, 4)}%` : '4%',
                  backgroundColor: verdictColor(d.verdict),
                  minWidth: 4,
                }}
                title={`${d.date}: ${d.verdict ?? 'pending'} (${d.score ?? '-'}%)`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-sg-text3">{trendData[0]?.date}</span>
            <span className="text-[10px] text-sg-text3">{trendData[trendData.length - 1]?.date}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl border border-sg-border bg-sg-bg1 p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-sg-text2 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: color ?? '#ffffff' }}>
        {value}
      </p>
    </div>
  );
}

function VerdictBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-mono font-medium w-16" style={{ color }}>
        {label}
      </span>
      <div className="flex-1 h-2 bg-sg-bg3 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-sg-text2 w-12 text-right">
        {count} ({pct}%)
      </span>
    </div>
  );
}
