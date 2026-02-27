'use client';

import { useDeployments } from '@/hooks/use-integrations';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/shared/skeleton';
import { ExternalLink, Rocket } from 'lucide-react';

function statusColor(status: string) {
  switch (status) {
    case 'ready':
      return 'bg-sg-ship';
    case 'building':
      return 'bg-sg-warn animate-pulse';
    case 'error':
      return 'bg-sg-noship';
    case 'cancelled':
      return 'bg-sg-text3';
    default:
      return 'bg-sg-text3';
  }
}

function envBadge(env: string | null) {
  if (!env) return null;
  const color =
    env === 'production' ? 'text-sg-ship bg-sg-ship-bg' : 'text-sg-blue bg-sg-blue-bg';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${color}`}>
      {env}
    </span>
  );
}

function ProviderBadge({ provider }: { provider: string }) {
  return (
    <span className="text-[10px] font-mono text-sg-text3 bg-sg-bg3 px-1.5 py-0.5 rounded capitalize">
      {provider}
    </span>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function DeployFeed({ limit = 20 }: { limit?: number }) {
  const { data, isLoading } = useDeployments(limit);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-card" />
        ))}
      </div>
    );
  }

  const deployments = data?.deployments ?? [];

  if (deployments.length === 0) {
    return (
      <EmptyState
        title="No deployments yet"
        description="Set up a deployment provider above to track Vercel or Railway deployments."
      />
    );
  }

  return (
    <div className="space-y-2">
      {deployments.map((d) => (
        <div
          key={d.id}
          className="flex items-center gap-3 p-3 rounded-card bg-sg-bg1 border border-sg-border"
        >
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`w-2 h-2 rounded-full ${statusColor(d.status)}`} />
            <Rocket className="w-4 h-4 text-sg-text3" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-medium text-sg-text0 truncate">
                {d.projectName}
              </span>
              <ProviderBadge provider={d.provider} />
              {envBadge(d.environment)}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-sg-text3">
              <span className="capitalize">{d.status}</span>
              {d.branch && (
                <>
                  <span>·</span>
                  <span>{d.branch}</span>
                </>
              )}
              {d.commitSha && (
                <>
                  <span>·</span>
                  <span className="font-mono">{d.commitSha.slice(0, 7)}</span>
                </>
              )}
              {d.creator && (
                <>
                  <span>·</span>
                  <span>{d.creator}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] text-sg-text3">
              {timeAgo(d.startedAt)}
            </span>
            {d.url && (
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded hover:bg-sg-bg3 text-sg-text3 hover:text-sg-text1 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
