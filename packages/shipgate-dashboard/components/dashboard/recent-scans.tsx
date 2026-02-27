'use client';

import { useRuns } from '@/hooks/use-data';
import { Skeleton } from '@/components/shared/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';

function verdictStyle(verdict: string | null) {
  switch (verdict) {
    case 'SHIP':
      return { color: '#00e68a', bg: 'rgba(0,230,138,0.08)', border: 'rgba(0,230,138,0.2)' };
    case 'NO_SHIP':
      return { color: '#ff5c6a', bg: 'rgba(255,92,106,0.08)', border: 'rgba(255,92,106,0.2)' };
    case 'WARN':
      return { color: '#ffb547', bg: 'rgba(255,181,71,0.08)', border: 'rgba(255,181,71,0.2)' };
    default:
      return { color: '#8888a0', bg: 'rgba(136,136,160,0.08)', border: 'rgba(136,136,160,0.2)' };
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function RecentScans() {
  const { data, isLoading, error, refetch } = useRuns(undefined, 5);

  if (isLoading) {
    return (
      <div className="bg-sg-bg1 border border-sg-border rounded-card p-6">
        <div className="text-lg font-semibold text-sg-text0 mb-4">Recent Scans</div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-sg-bg2/50 border border-sg-border/50">
              <Skeleton className="h-5 w-14" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2 w-48" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  if (!data || data.length === 0) {
    return (
      <div className="bg-sg-bg1 border border-sg-border rounded-card p-6">
        <EmptyState title="No Scans Yet" description="Run `shipgate scan` to see results here." />
      </div>
    );
  }

  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card p-6">
      <h2 className="text-lg font-semibold text-sg-text0 mb-4">Recent Scans</h2>

      <div className="space-y-3">
        {data.map((run) => {
          const vs = verdictStyle(run.verdict);
          return (
            <div
              key={run.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-sg-bg2/50 border border-sg-border/50"
            >
              <span
                className="text-[10px] py-0.5 px-2 rounded font-semibold font-mono shrink-0"
                style={{ color: vs.color, background: vs.bg, border: `1px solid ${vs.border}` }}
              >
                {run.verdict ?? run.status}
              </span>

              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-sg-text0 font-medium">{run.projectName}</div>
                <div className="flex items-center gap-2 text-[11px] text-sg-text3">
                  {run.branch && <span className="font-mono">{run.branch}</span>}
                  {run.commitSha && (
                    <span className="font-mono opacity-60">{run.commitSha.slice(0, 7)}</span>
                  )}
                  {run.userName && (
                    <>
                      <span>·</span>
                      <span>{run.userName}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-sg-text3 text-right shrink-0">
                {timeAgo(run.startedAt)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
