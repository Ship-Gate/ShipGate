'use client';

import { useApi } from '@/hooks/use-api';
import { Skeleton } from '@/components/shared/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';
import type { RunSummary } from '@/hooks/use-data';

function verdictStyle(verdict: string | null) {
  switch (verdict) {
    case 'SHIP':
      return { color: '#00e68a', bg: 'rgba(0,230,138,0.08)' };
    case 'NO_SHIP':
      return { color: '#ff5c6a', bg: 'rgba(255,92,106,0.08)' };
    case 'WARN':
      return { color: '#ffb547', bg: 'rgba(255,181,71,0.08)' };
    default:
      return { color: '#38bdf8', bg: 'rgba(56,189,248,0.08)' };
  }
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

export function CicdPanel() {
  const { data, isLoading, error, refetch } = useApi<RunSummary[]>(
    '/api/v1/runs?trigger=ci&limit=5'
  );

  if (isLoading) {
    return (
      <div className="bg-sg-bg1 border border-sg-border rounded-card p-5">
        <Skeleton className="h-4 w-28 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-sg-bg2/30 border border-sg-border/50">
              <Skeleton className="w-2 h-2 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-2 w-32" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  if (!data || data.length === 0) {
    return (
      <div className="bg-sg-bg1 border border-sg-border rounded-card">
        <EmptyState
          title="CI/CD Pipeline"
          description="No CI-triggered runs yet. Connect your CI pipeline to see results."
        />
      </div>
    );
  }

  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-sg-text0">CI/CD Pipeline</h3>
        <span className="text-[10px] text-sg-text3">{data.length} runs</span>
      </div>

      <div>
        {data.map((run) => {
          const vs = verdictStyle(run.verdict);
          return (
            <div
              key={run.id}
              className="flex items-center gap-2.5 py-2.5 px-5 border-b border-sg-border last:border-b-0"
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  background: run.status === 'running' ? '#38bdf8' :
                    run.status === 'completed' ? (run.verdict === 'SHIP' ? '#00e68a' : '#ff5c6a') :
                    '#555566',
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-sg-text0 truncate">
                    {run.projectName}
                  </span>
                  {run.branch && (
                    <span className="text-[10px] text-sg-accent font-mono shrink-0">
                      {run.branch}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 text-[10px] text-sg-text3 mt-0.5">
                  {run.commitSha && <span className="font-mono">{run.commitSha.slice(0, 7)}</span>}
                  {run.userName && (
                    <>
                      <span>·</span>
                      <span>{run.userName}</span>
                    </>
                  )}
                </div>
              </div>
              {run.verdict && (
                <span
                  className="text-[9px] py-0.5 px-1.5 rounded font-semibold shrink-0"
                  style={{ color: vs.color, background: vs.bg }}
                >
                  {run.verdict}
                </span>
              )}
              <span className="text-[10px] text-sg-text3 font-mono w-[50px] text-right shrink-0">
                {formatDuration(run.durationMs)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
