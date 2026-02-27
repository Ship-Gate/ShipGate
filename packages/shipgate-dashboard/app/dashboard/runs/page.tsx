'use client';

import { useRuns } from '@/hooks/use-data';
import { TableSkeleton } from '@/components/shared/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';

function formatDuration(ms: number | null): string {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function verdictColor(verdict: string | null): string {
  if (!verdict) return 'text-sg-text3';
  switch (verdict) {
    case 'SHIP':
      return 'text-sg-ship';
    case 'WARN':
      return 'text-sg-warn';
    case 'NO_SHIP':
      return 'text-sg-noship';
    default:
      return 'text-sg-text2';
  }
}

export default function RunsPage() {
  const { data: runs, isLoading, error, refetch } = useRuns();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Runs</h1>
          <p className="text-sg-text2 text-sm">Verification run history and status</p>
        </div>
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Runs</h1>
          <p className="text-sg-text2 text-sm">Verification run history and status</p>
        </div>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  if (!runs?.length) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Runs</h1>
          <p className="text-sg-text2 text-sm">Verification run history and status</p>
        </div>
        <EmptyState
          title="No verification runs"
          description="Run `shipgate scan` from CLI or VS Code to see results here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-sg-text0">Runs</h1>
        <p className="text-sg-text2 text-sm">Verification run history and status</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-sg-border bg-sg-bg1">
        <table className="w-full">
          <thead>
            <tr className="border-b border-sg-border">
              <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                Project
              </th>
              <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                Branch
              </th>
              <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                Verdict
              </th>
              <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                Score
              </th>
              <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                Findings
              </th>
              <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                Agent
              </th>
              <th className="text-left p-4 text-xs font-medium uppercase tracking-wider text-sg-text2">
                Duration
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
                <td className="p-4 text-sg-text1 text-sm">{run.branch ?? '-'}</td>
                <td className="p-4">
                  <span
                    className={`text-sm font-medium ${verdictColor(run.verdict)}`}
                  >
                    {run.verdict ?? '-'}
                  </span>
                </td>
                <td className="p-4 text-sg-text1">
                  {run.score != null ? `${Math.round(run.score * 100)}%` : '-'}
                </td>
                <td className="p-4 text-sg-text1">{run.findingCount}</td>
                <td className="p-4 text-sg-text2 text-sm capitalize">{run.agentType}</td>
                <td className="p-4 text-sg-text1 text-sm">
                  {formatDuration(run.durationMs)}
                </td>
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
