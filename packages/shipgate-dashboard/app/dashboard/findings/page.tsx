'use client';

import { useFindingsBreakdown } from '@/hooks/use-data';
import { useApi } from '@/hooks/use-api';
import { CardSkeleton, TableSkeleton } from '@/components/shared/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';

interface FindingWithRun {
  id: string;
  severity: string;
  category: string;
  title: string;
  filePath: string | null;
  message: string;
}

function severityColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'text-sg-noship';
    case 'high':
      return 'text-sg-warn';
    case 'medium':
      return 'text-sg-accent';
    case 'low':
    case 'info':
      return 'text-sg-text2';
    default:
      return 'text-sg-text2';
  }
}

function SeverityCard({
  label,
  count,
  colorClass,
}: {
  label: string;
  count: number;
  colorClass: string;
}) {
  return (
    <div className="rounded-xl border border-sg-border bg-sg-bg1 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-sg-text2 mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold ${colorClass}`}>{count}</p>
    </div>
  );
}

export default function FindingsPage() {
  const {
    data: breakdown,
    isLoading: breakdownLoading,
    error: breakdownError,
    refetch: refetchBreakdown,
  } = useFindingsBreakdown(undefined, 'severity');

  const {
    data: findings,
    isLoading: findingsLoading,
    error: findingsError,
    refetch: refetchFindings,
  } = useApi<FindingWithRun[]>('/api/v1/metrics/findings?groupBy=list');

  const isLoading = breakdownLoading || findingsLoading;
  const error = breakdownError || findingsError;
  const refetch = () => {
    refetchBreakdown();
    refetchFindings();
  };

  const breakdownMap =
    breakdown?.reduce(
      (acc, item) => {
        acc[item.key.toLowerCase()] = item.count;
        return acc;
      },
      {} as Record<string, number>
    ) ?? {};

  const critical = breakdownMap['critical'] ?? 0;
  const high = breakdownMap['high'] ?? 0;
  const medium = breakdownMap['medium'] ?? 0;
  const low =
    (breakdownMap['low'] ?? 0) + (breakdownMap['info'] ?? 0);

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Findings</h1>
          <p className="text-sg-text2 text-sm">Security and compliance findings</p>
        </div>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Findings</h1>
          <p className="text-sg-text2 text-sm">Security and compliance findings</p>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <TableSkeleton rows={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Findings</h1>
        <p className="text-sg-text2 text-sm">Security and compliance findings</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SeverityCard label="Critical" count={critical} colorClass="text-sg-noship" />
        <SeverityCard label="High" count={high} colorClass="text-sg-warn" />
        <SeverityCard label="Medium" count={medium} colorClass="text-sg-accent" />
        <SeverityCard label="Low" count={low} colorClass="text-sg-text2" />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-sg-text0 mb-4">All Findings</h2>
        {!findings?.length ? (
          <EmptyState
            title="No findings"
            description="Run a scan to discover security and compliance issues."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-sg-border bg-sg-bg1">
            <table className="w-full">
              <thead>
                <tr className="border-b border-sg-border">
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    Severity
                  </th>
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    Category
                  </th>
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    Title
                  </th>
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    File
                  </th>
                  <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                    Message
                  </th>
                </tr>
              </thead>
              <tbody>
                {findings.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-sg-border last:border-0 hover:bg-sg-bg2/50"
                  >
                    <td className="p-4">
                      <span
                        className={`text-sm font-medium capitalize ${severityColor(f.severity)}`}
                      >
                        {f.severity}
                      </span>
                    </td>
                    <td className="p-4 text-sg-text1 text-sm">{f.category}</td>
                    <td className="p-4 font-medium text-sg-text0">{f.title}</td>
                    <td className="p-4 font-mono text-xs text-sg-text2 truncate max-w-[200px]">
                      {f.filePath ?? '-'}
                    </td>
                    <td className="p-4 text-sg-text2 text-sm max-w-[280px] truncate">
                      {f.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
