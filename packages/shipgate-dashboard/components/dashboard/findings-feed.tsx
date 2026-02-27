'use client';

import { useFindingsBreakdown } from '@/hooks/use-data';
import { useApi } from '@/hooks/use-api';
import { Skeleton } from '@/components/shared/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';
import type { FindingItem } from '@/hooks/use-data';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff5c6a',
  high: '#ff8a4c',
  medium: '#ffb547',
  low: '#555566',
  info: '#38bdf8',
};

function severityColor(severity: string): string {
  return SEVERITY_COLORS[severity.toLowerCase()] ?? '#555566';
}

export function FindingsFeed() {
  const breakdown = useFindingsBreakdown();
  const recent = useApi<FindingItem[]>('/api/v1/metrics/findings?limit=10');

  const isLoading = breakdown.isLoading || recent.isLoading;
  const error = breakdown.error || recent.error;

  if (isLoading) {
    return (
      <div className="bg-sg-bg1 border border-sg-border rounded-card p-5">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 py-2">
              <Skeleton className="w-1.5 h-1.5 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => { breakdown.refetch(); recent.refetch(); }} />;
  }

  const findings = recent.data ?? [];
  const counts = breakdown.data ?? [];

  if (findings.length === 0 && counts.length === 0) {
    return (
      <div className="bg-sg-bg1 border border-sg-border rounded-card">
        <EmptyState title="No Findings" description="No findings detected across your scans." />
      </div>
    );
  }

  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-sg-text0">Active Findings</h3>
          <span className="text-[10px] text-sg-text3">
            {findings.length} recent
          </span>
        </div>
        <div className="flex gap-1">
          {counts.map(({ key, count }) => (
            <span
              key={key}
              className="text-[9px] py-0.5 px-1.5 rounded-[3px] font-mono"
              style={{
                background: `${severityColor(key)}10`,
                color: severityColor(key),
                border: `1px solid ${severityColor(key)}18`,
              }}
            >
              {count} {key}
            </span>
          ))}
        </div>
      </div>

      <div>
        {findings.map((f) => (
          <div
            key={f.id}
            className="flex items-center gap-2.5 py-2 px-5 border-b border-sg-border last:border-b-0"
          >
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: severityColor(f.severity),
                boxShadow: f.severity === 'critical' ? '0 0 6px rgba(255,92,106,0.6)' : 'none',
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-sg-text1 leading-snug">{f.title}</div>
              <div className="text-[10px] text-sg-text3 mt-0.5 flex gap-2">
                {f.filePath && (
                  <span className="font-mono">
                    {f.filePath}
                    {f.lineStart != null ? `:${f.lineStart}` : ''}
                  </span>
                )}
                <span>{f.category}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
