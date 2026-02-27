'use client';

import { useGitHubPrs } from '@/hooks/use-integrations';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/shared/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { GitPullRequest, ExternalLink } from 'lucide-react';
import Image from 'next/image';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function GitHubPrList() {
  const { data, isLoading, error, refetch } = useGitHubPrs();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-card" />
        ))}
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  if (!data?.connected) {
    return (
      <EmptyState
        title="GitHub not connected"
        description="Connect GitHub from the overview page to see pull requests."
      />
    );
  }

  if (data.prs.length === 0) {
    return (
      <EmptyState
        title="No open pull requests"
        description="Open PRs from your connected repos will appear here."
      />
    );
  }

  return (
    <div className="space-y-2">
      {data.prs.map((pr) => (
        <a
          key={pr.id}
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 p-3 rounded-card bg-sg-bg1 border border-sg-border hover:border-sg-accent/40 transition-colors group"
        >
          <div className="mt-0.5">
            <GitPullRequest
              className={`w-4 h-4 ${
                pr.draft ? 'text-sg-text3' : 'text-sg-ship'
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-medium text-sg-text0 truncate group-hover:text-sg-accent transition-colors">
                {pr.title}
              </span>
              <ExternalLink className="w-3 h-3 text-sg-text3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-sg-text3">
              <span className="font-mono">
                {pr.repo.split('/')[1]}#{pr.number}
              </span>
              <span>·</span>
              <span>{pr.branch}</span>
              {pr.draft && (
                <>
                  <span>·</span>
                  <span className="text-sg-warn">Draft</span>
                </>
              )}
            </div>
            {pr.labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {pr.labels.slice(0, 4).map((label) => (
                  <span
                    key={label.name}
                    className="px-1.5 py-0.5 text-[10px] rounded-full border border-sg-border"
                    style={{
                      color: `#${label.color}`,
                      borderColor: `#${label.color}33`,
                      backgroundColor: `#${label.color}0d`,
                    }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {pr.authorAvatar && (
              <Image
                src={pr.authorAvatar}
                alt={pr.author}
                width={20}
                height={20}
                className="rounded-full"
              />
            )}
            <span className="text-[11px] text-sg-text3">
              {timeAgo(pr.updatedAt)}
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}
