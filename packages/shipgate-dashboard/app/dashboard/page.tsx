'use client';

import { useOverview, useRuns } from '@/hooks/use-data';
import { EmptyState } from '@/components/shared/empty-state';
import { PageSkeleton } from '@/components/shared/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { Sparkline } from '@/components/shared/sparkline';
import { VerdictChart } from '@/components/dashboard/verdict-chart';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { IntegrationsStrip } from '@/components/dashboard/integrations-strip';
import Link from 'next/link';

function verdictClasses(verdict: string | null) {
  if (!verdict) return 'text-sg-text3 bg-sg-bg2';
  const v = verdict.toUpperCase();
  if (v === 'SHIP') return 'text-sg-ship bg-sg-ship-bg';
  if (v === 'WARN') return 'text-sg-warn bg-sg-warn-bg';
  if (v === 'NO_SHIP') return 'text-sg-noship bg-sg-noship-bg';
  return 'text-sg-text3 bg-sg-bg2';
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function deriveSparklineData(
  trend: Array<{ date: string; verdict: string | null; score: number | null; status: string }>,
  metric: 'runs' | 'shipRate'
): number[] {
  if (!trend || trend.length === 0) return [];

  const byDate = new Map<string, { total: number; ships: number }>();
  for (const t of trend) {
    const day = t.date.slice(0, 10);
    const entry = byDate.get(day) ?? { total: 0, ships: 0 };
    entry.total++;
    if (t.verdict === 'SHIP') entry.ships++;
    byDate.set(day, entry);
  }

  const sorted = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));

  if (metric === 'runs') {
    return sorted.map(([, v]) => v.total);
  }
  return sorted.map(([, v]) =>
    v.total > 0 ? Math.round((v.ships / v.total) * 100) : 0
  );
}

const STAT_CARDS = [
  {
    key: 'totalRuns' as const,
    label: 'TOTAL RUNS',
    color: '#6366f1',
    subtitle: 'all time',
    sparklineMetric: 'runs' as const,
    format: (v: number) => String(v),
  },
  {
    key: 'shipRate' as const,
    label: 'SHIP RATE',
    color: '#00e68a',
    subtitle: 'passing runs',
    sparklineMetric: 'shipRate' as const,
    format: (v: number) => `${(v * 100).toFixed(1)}%`,
  },
  {
    key: 'totalFindings' as const,
    label: 'TOTAL FINDINGS',
    color: '#ff5c6a',
    subtitle: 'across all runs',
    sparklineMetric: null,
    format: (v: number) => String(v),
  },
  {
    key: 'projectCount' as const,
    label: 'PROJECTS',
    color: '#38bdf8',
    subtitle: 'registered',
    sparklineMetric: null,
    format: (v: number) => String(v),
  },
] as const;

export default function DashboardPage() {
  const {
    data: overview,
    isLoading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useOverview();
  const {
    data: runs,
    isLoading: runsLoading,
    error: runsError,
    refetch: refetchRuns,
  } = useRuns(undefined, 10);

  const isLoading = overviewLoading || runsLoading;
  const error = overviewError || runsError;
  const refetch = () => {
    refetchOverview();
    refetchRuns();
  };

  const hasData =
    overview &&
    (overview.totalRuns > 0 || (runs?.length ?? 0) > 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="No data yet"
          description="Run your first scan with `shipgate scan` from CLI or VS Code."
        />
      </div>
    );
  }

  const recentRuns = runs ?? [];
  const trend = overview?.trend ?? [];

  return (
    <div className="space-y-6">
      {/* Summary cards with sparklines */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => {
          const rawValue = overview?.[card.key] ?? 0;
          const sparkData = card.sparklineMetric
            ? deriveSparklineData(trend, card.sparklineMetric)
            : [];

          return (
            <div
              key={card.label}
              className="bg-sg-bg1 border border-sg-border rounded-card p-5 relative overflow-hidden"
            >
              <div
                className="absolute -top-12 -right-12 w-20 h-20 rounded-full opacity-[0.12]"
                style={{ background: card.color, filter: 'blur(25px)' }}
              />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] text-sg-text3 uppercase tracking-wider">
                    {card.label}
                  </div>
                  {sparkData.length >= 2 && (
                    <Sparkline
                      data={sparkData}
                      color={card.color}
                      width={54}
                      height={16}
                    />
                  )}
                </div>
                <div
                  className="text-[28px] font-bold font-mono tracking-tight mb-1"
                  style={{ color: card.color }}
                >
                  {card.format(rawValue)}
                </div>
                <div className="text-[11px] text-sg-text3">{card.subtitle}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Integrations strip */}
      <IntegrationsStrip />

      {/* Middle row: verdict chart + activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-sg-bg1 border border-sg-border rounded-card p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-sg-text0">
              Verdict Breakdown
            </h2>
            <p className="text-[11px] text-sg-text3">
              Distribution across all runs
            </p>
          </div>
          <VerdictChart breakdown={overview?.verdictBreakdown ?? {}} />
        </div>

        <div className="bg-sg-bg1 border border-sg-border rounded-card p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-sg-text0">
              Recent Activity
            </h2>
            <p className="text-[11px] text-sg-text3">
              Latest events across your workspace
            </p>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            <ActivityFeed limit={10} />
          </div>
        </div>
      </div>

      {/* Recent runs table */}
      <div className="bg-sg-bg1 border border-sg-border rounded-card overflow-hidden">
        <div className="px-4 py-3 border-b border-sg-border">
          <h2 className="text-sm font-semibold text-sg-text0">Recent Runs</h2>
          <p className="text-xs text-sg-text3">
            Last 10 runs across all projects
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-sg-border">
                <th className="text-left p-3 text-xs font-medium text-sg-text2">
                  Project
                </th>
                <th className="text-left p-3 text-xs font-medium text-sg-text2">
                  Status
                </th>
                <th className="text-left p-3 text-xs font-medium text-sg-text2">
                  Verdict
                </th>
                <th className="text-left p-3 text-xs font-medium text-sg-text2">
                  Findings
                </th>
                <th className="text-left p-3 text-xs font-medium text-sg-text2">
                  Duration
                </th>
                <th className="text-left p-3 text-xs font-medium text-sg-text2">
                  Started
                </th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((run) => (
                <tr
                  key={run.id}
                  className="border-b border-sg-border last:border-0 hover:bg-sg-bg2/50"
                >
                  <td className="p-3">
                    <Link
                      href={`/dashboard/runs/${run.id}`}
                      className="font-medium text-sg-text0 hover:text-sg-accent transition-colors"
                    >
                      {run.projectName}
                    </Link>
                  </td>
                  <td className="p-3">
                    <span className="text-xs text-sg-text1 capitalize">
                      {run.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex text-[10px] font-mono font-semibold px-2 py-1 rounded-badge ${verdictClasses(run.verdict)}`}
                    >
                      {run.verdict ?? '—'}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-sg-text1">
                    {run.findingCount}
                  </td>
                  <td className="p-3 text-xs text-sg-text1">
                    {formatDuration(run.durationMs)}
                  </td>
                  <td className="p-3 text-xs text-sg-text3">
                    {formatDate(run.startedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
