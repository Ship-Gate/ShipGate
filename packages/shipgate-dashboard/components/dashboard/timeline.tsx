'use client';

import { useRuns } from '@/hooks/use-data';
import { Skeleton } from '@/components/shared/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';

const VERDICT_STYLE: Record<string, { color: string; icon: string }> = {
  SHIP: { color: '#00e68a', icon: '✓' },
  NO_SHIP: { color: '#ff5c6a', icon: '✗' },
  WARN: { color: '#ffb547', icon: '!' },
};

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

export function Timeline() {
  const { data, isLoading, error, refetch } = useRuns(undefined, 10);

  if (isLoading) {
    return (
      <div className="bg-sg-bg1 border border-sg-border rounded-card p-5">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-5 h-5 rounded-full shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-2 w-32" />
              </div>
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
        <EmptyState title="Activity Timeline" description="No activity yet. Run a scan to get started." />
      </div>
    );
  }

  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card">
      <div className="px-5 pt-5 pb-2">
        <h3 className="text-sm font-semibold text-sg-text0">Activity Timeline</h3>
      </div>

      <div className="py-1">
        {data.map((run, i) => {
          const style = VERDICT_STYLE[run.verdict ?? ''] ?? { color: '#38bdf8', icon: '◎' };

          return (
            <div key={run.id} className="flex gap-3 py-2 px-5 relative">
              {i < data.length - 1 && (
                <div
                  className="absolute left-[29px] top-7 -bottom-2 w-px bg-sg-border"
                  aria-hidden
                />
              )}
              <div
                className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold relative z-10"
                style={{
                  color: style.color,
                  background: `${style.color}12`,
                  border: `1px solid ${style.color}25`,
                }}
              >
                {style.icon}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="text-xs text-sg-text1 leading-snug">
                  <span className="font-medium">{run.projectName}</span>
                  {' — '}
                  <span>{run.verdict ?? run.status}</span>
                  {run.score != null && (
                    <span className="font-mono ml-1" style={{ color: style.color }}>
                      {run.score}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-sg-text3 mt-0.5">
                  {run.branch && <span className="font-mono">{run.branch}</span>}
                  {run.userName && <span> · {run.userName}</span>}
                  {' · '}
                  {timeAgo(run.startedAt)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
