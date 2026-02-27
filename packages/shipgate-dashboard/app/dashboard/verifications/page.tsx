'use client';

import { useRuns } from '@/hooks/use-data';
import { TableSkeleton } from '@/components/shared/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function statusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'text-sg-ship';
    case 'running':
    case 'pending':
      return 'text-sg-warn';
    case 'failed':
      return 'text-sg-noship';
    default:
      return 'text-sg-text2';
  }
}

export default function VerificationsPage() {
  const { data: runs, isLoading, error, refetch } = useRuns();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">
            Verifications
          </h1>
          <p className="text-sg-text2 text-sm">
            Recent verification runs and their results
          </p>
        </div>
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">
            Verifications
          </h1>
          <p className="text-sg-text2 text-sm">
            Recent verification runs and their results
          </p>
        </div>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  if (!runs?.length) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">
            Verifications
          </h1>
          <p className="text-sg-text2 text-sm">
            Recent verification runs and their results
          </p>
        </div>
        <EmptyState
          title="No verifications"
          description="Run `shipgate scan` from CLI or VS Code to see results here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-sg-text0">
          Verifications
        </h1>
        <p className="text-sg-text2 text-sm">
          Recent verification runs and their results
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-sg-border bg-sg-bg1">
        <table className="w-full">
          <thead>
            <tr className="border-b border-sg-border">
              <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                Project
              </th>
              <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                Status
              </th>
              <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                Trust Score
              </th>
              <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                Violations
              </th>
              <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                Warnings
              </th>
              <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr
                key={run.id}
                className="border-b border-sg-border last:border-0 hover:bg-sg-bg2/50"
              >
                <td className="p-4 font-medium text-sg-text0">{run.projectName}</td>
                <td className="p-4">
                  <span
                    className={`text-sm font-medium capitalize ${statusColor(run.status)}`}
                  >
                    {run.status}
                  </span>
                </td>
                <td className="p-4 text-sg-text1">
                  {run.score != null ? `${Math.round(run.score * 100)}%` : '-'}
                </td>
                <td className="p-4 text-sg-text1">{run.findingCount}</td>
                <td className="p-4 text-sg-text2">-</td>
                <td className="p-4 text-sg-text3 text-sm">
                  {formatDate(run.startedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
