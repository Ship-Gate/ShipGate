'use client';

import { useParams } from 'next/navigation';
import { useApi } from '@/hooks/use-api';
import { CardSkeleton } from '@/components/shared/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { RingChart } from '@/components/shared/ring-chart';

interface SharedRunData {
  projectName: string;
  branch: string | null;
  verdict: string | null;
  score: number | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  findingsSummary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  proofCount: number;
}

function verdictConfig(verdict: string | null) {
  switch (verdict) {
    case 'SHIP':
      return { color: '#00e68a', bg: 'rgba(0,230,138,0.08)', border: 'rgba(0,230,138,0.2)', label: 'SHIP' };
    case 'WARN':
      return { color: '#ffb547', bg: 'rgba(255,181,71,0.08)', border: 'rgba(255,181,71,0.2)', label: 'WARN' };
    case 'NO_SHIP':
      return { color: '#ff5c6a', bg: 'rgba(255,92,106,0.08)', border: 'rgba(255,92,106,0.2)', label: 'NO_SHIP' };
    default:
      return { color: '#555566', bg: 'rgba(85,85,102,0.08)', border: 'rgba(85,85,102,0.2)', label: '—' };
  }
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function SharedReportPage() {
  const params = useParams();
  const token = params.token as string;
  const { data, isLoading, error } = useApi<SharedRunData>(`/api/v1/shared/${token}`);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sg-bg0 flex items-center justify-center">
        <div className="w-full max-w-2xl p-8">
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-sg-bg0 flex items-center justify-center">
        <div className="w-full max-w-md p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-sg-text0 mb-2">Report Not Found</h1>
          <p className="text-sm text-sg-text2">
            This shared report link may have expired or is invalid.
          </p>
        </div>
      </div>
    );
  }

  const vc = verdictConfig(data.verdict);
  const score = data.score != null ? Math.round(data.score * 100) : null;

  return (
    <div className="min-h-screen bg-sg-bg0">
      <div className="max-w-2xl mx-auto py-12 px-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <img src="/logo.png" alt="ShipGate" className="w-6 h-6 rounded" />
          <span className="text-sm font-bold text-sg-text0">ShipGate</span>
          <span className="text-xs text-sg-text3">· Verification Report</span>
        </div>

        {/* Main card */}
        <div className="rounded-xl border border-sg-border bg-sg-bg1 p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-sg-text0">{data.projectName}</h1>
              <div className="flex items-center gap-2 mt-1">
                {data.branch && (
                  <span className="text-xs text-sg-text2 font-mono bg-sg-bg2 px-2 py-0.5 rounded">
                    {data.branch}
                  </span>
                )}
                <span className="text-xs text-sg-text3">{formatDate(data.startedAt)}</span>
              </div>
            </div>
            <span
              className="text-sm font-mono font-semibold px-3 py-1.5 rounded-badge border"
              style={{ backgroundColor: vc.bg, borderColor: vc.border, color: vc.color }}
            >
              {vc.label}
            </span>
          </div>

          {/* Score */}
          <div className="flex items-center gap-6 mb-6 pb-6 border-b border-sg-border">
            <RingChart value={score ?? 0} size={80} stroke={6} color={vc.color}>
              <span className="text-lg font-bold text-sg-text0">{score ?? '-'}</span>
            </RingChart>
            <div>
              <p className="text-sm text-sg-text2">Ship Score</p>
              <p className="text-3xl font-bold text-sg-text0">{score != null ? `${score}%` : '-'}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
            <div>
              <p className="text-xs text-sg-text2 uppercase tracking-wider">Findings</p>
              <p className="text-xl font-bold text-sg-text0">{data.findingsSummary.total}</p>
            </div>
            <div>
              <p className="text-xs text-sg-text2 uppercase tracking-wider">Critical</p>
              <p className="text-xl font-bold text-sg-noship">{data.findingsSummary.critical}</p>
            </div>
            <div>
              <p className="text-xs text-sg-text2 uppercase tracking-wider">Duration</p>
              <p className="text-xl font-bold text-sg-text0">{formatDuration(data.durationMs)}</p>
            </div>
            <div>
              <p className="text-xs text-sg-text2 uppercase tracking-wider">Proofs</p>
              <p className="text-xl font-bold text-sg-text0">{data.proofCount}</p>
            </div>
          </div>

          {/* Findings breakdown */}
          {data.findingsSummary.total > 0 && (
            <div className="rounded-lg bg-sg-bg2 p-4">
              <p className="text-xs font-medium text-sg-text2 uppercase tracking-wider mb-3">Findings Breakdown</p>
              <div className="space-y-2">
                {data.findingsSummary.critical > 0 && (
                  <FindingBar label="Critical" count={data.findingsSummary.critical} total={data.findingsSummary.total} color="#ff5c6a" />
                )}
                {data.findingsSummary.high > 0 && (
                  <FindingBar label="High" count={data.findingsSummary.high} total={data.findingsSummary.total} color="#ffb547" />
                )}
                {data.findingsSummary.medium > 0 && (
                  <FindingBar label="Medium" count={data.findingsSummary.medium} total={data.findingsSummary.total} color="#6366f1" />
                )}
                {data.findingsSummary.low > 0 && (
                  <FindingBar label="Low" count={data.findingsSummary.low} total={data.findingsSummary.total} color="#8888a0" />
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-sg-text3 mt-6">
          Generated by ShipGate · <a href="https://shipgate.dev" className="text-sg-accent hover:underline">shipgate.dev</a>
        </p>
      </div>
    </div>
  );
}

function FindingBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = Math.round((count / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-16" style={{ color }}>{label}</span>
      <div className="flex-1 h-2 bg-sg-bg3 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs text-sg-text2 w-6 text-right">{count}</span>
    </div>
  );
}
