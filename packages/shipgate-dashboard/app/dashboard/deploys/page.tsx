'use client';

import Link from 'next/link';
import { useApi } from '@/hooks/use-api';
import type { RunSummary } from '@/hooks/use-data';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { CardSkeleton } from '@/components/shared/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { DeployProviderSetup } from '@/components/dashboard/deploy-provider-setup';
import { DeployFeed } from '@/components/dashboard/deploy-feed';

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return <span className="text-xs text-sg-text3">—</span>;
  const map: Record<string, string> = {
    SHIP: 'text-sg-ship',
    WARN: 'text-sg-warn',
    NO_SHIP: 'text-sg-noship',
  };
  const cls = map[verdict] ?? 'text-sg-text3';
  return (
    <span className={`text-xs font-medium ${cls}`}>
      {verdict.replace('_', ' ')}
    </span>
  );
}

export default function DeploysPage() {
  const { data, isLoading, error, refetch } = useApi<RunSummary[]>(
    '/api/v1/runs?trigger=ci&limit=20'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-sg-text0">Deployments</h1>
        <p className="text-sm text-sg-text3 mt-1">
          Track deployments from Vercel, Railway, and CI-triggered runs.
        </p>
      </div>

      <DeployProviderSetup />

      <div>
        <h2 className="text-sm font-semibold text-sg-text0 mb-3">
          Webhook Deployments
        </h2>
        <DeployFeed limit={15} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-sg-text0 mb-3">
          CI-Triggered Runs
        </h2>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (data ?? []).length === 0 ? (
          <EmptyState
            title="No CI-triggered runs"
            description="Run ShipGate in your CI pipeline to track deployments."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(data ?? []).map((run) => (
              <Link key={run.id} href={`/dashboard/runs?runId=${run.id}`}>
                <Card className="bg-sg-bg1 border border-sg-border rounded-xl p-5 transition-colors hover:border-sg-accent/50">
                  <CardContent className="p-0">
                    <h3 className="text-base font-semibold text-sg-text0 mb-1">
                      {run.projectName}
                    </h3>
                    {run.branch && (
                      <p className="text-xs text-sg-text3 mb-2">
                        {run.branch}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <VerdictBadge verdict={run.verdict} />
                      <span className="text-sg-text3">
                        {new Date(run.startedAt).toLocaleString()}
                      </span>
                    </div>
                    {run.commitSha && (
                      <p
                        className="text-xs text-sg-text3 font-mono mt-2 truncate"
                        title={run.commitSha}
                      >
                        {run.commitSha.slice(0, 7)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
