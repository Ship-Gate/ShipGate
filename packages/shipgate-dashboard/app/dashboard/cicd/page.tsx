'use client';

import Link from 'next/link';
import { useApi } from '@/hooks/use-api';
import type { RunSummary } from '@/hooks/use-data';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { TableSkeleton } from '@/components/shared/skeleton';

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return <span className="text-sg-text3">—</span>;
  const map: Record<string, string> = {
    SHIP: 'text-sg-ship',
    WARN: 'text-sg-warn',
    NO_SHIP: 'text-sg-noship',
  };
  const cls = map[verdict] ?? 'text-sg-text3';
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${cls}`}>
      {verdict.replace('_', ' ')}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'text-sg-text3',
    running: 'text-sg-warn',
    completed: 'text-sg-ship',
    failed: 'text-sg-noship',
  };
  const cls = map[status] ?? 'text-sg-text3';
  return <span className={`text-xs font-medium capitalize ${cls}`}>{status}</span>;
}

export default function CicdPage() {
  const { data, isLoading, error, refetch } = useApi<RunSummary[]>(
    '/api/v1/runs?trigger=ci&limit=20'
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-sg-text0">CI/CD</h1>
          <p className="text-sm text-sg-text3 mt-1">CI pipeline runs</p>
        </div>
        <TableSkeleton rows={10} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-sg-text0">CI/CD</h1>
        </div>
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  const runs = data ?? [];

  if (runs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-sg-text0">CI/CD</h1>
          <p className="text-sm text-sg-text3 mt-1">CI pipeline runs</p>
        </div>
        <EmptyState
          title="No CI/CD runs."
          description="Add ShipGate to your CI pipeline to see runs here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-sg-text0">CI/CD</h1>
        <p className="text-sm text-sg-text3 mt-1">CI pipeline runs</p>
      </div>
      <div className="rounded-xl border border-sg-border bg-sg-bg1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-sg-border bg-sg-bg2">
                <th className="text-left p-3 text-xs font-medium text-sg-text2">Project</th>
                <th className="text-left p-3 text-xs font-medium text-sg-text2">Branch</th>
                <th className="text-left p-3 text-xs font-medium text-sg-text2">Status</th>
                <th className="text-left p-3 text-xs font-medium text-sg-text2">Verdict</th>
                <th className="text-left p-3 text-xs font-medium text-sg-text2">Findings</th>
                <th className="text-left p-3 text-xs font-medium text-sg-text2">Duration</th>
                <th className="text-left p-3 text-xs font-medium text-sg-text2">Started</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className="border-b border-sg-border last:border-b-0 hover:bg-sg-bg2/50"
                >
                  <td className="p-3">
                    <Link
                      href={`/dashboard/runs?runId=${run.id}`}
                      className="text-sm font-medium text-sg-text0 hover:text-sg-accent"
                    >
                      {run.projectName}
                    </Link>
                  </td>
                  <td className="p-3 text-sm text-sg-text2">{run.branch ?? '—'}</td>
                  <td className="p-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="p-3">
                    <VerdictBadge verdict={run.verdict} />
                  </td>
                  <td className="p-3 text-sm text-sg-text2">{run.findingCount}</td>
                  <td className="p-3 text-sm text-sg-text2">
                    {run.durationMs != null ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}
                  </td>
                  <td className="p-3 text-xs text-sg-text3">
                    {new Date(run.startedAt).toLocaleString()}
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
