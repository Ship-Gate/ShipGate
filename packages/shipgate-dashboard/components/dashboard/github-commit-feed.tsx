'use client';

import { useGitHubCommits } from '@/hooks/use-integrations';
import { Skeleton } from '@/components/shared/skeleton';
import { GitCommit } from 'lucide-react';
import Image from 'next/image';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export function GitHubCommitFeed({ limit = 8 }: { limit?: number }) {
  const { data, isLoading } = useGitHubCommits(limit);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (!data?.connected || data.commits.length === 0) return null;

  return (
    <div className="space-y-1">
      {data.commits.map((commit) => (
        <a
          key={commit.sha}
          href={commit.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-sg-bg2 transition-colors group"
        >
          {commit.authorAvatar ? (
            <Image
              src={commit.authorAvatar}
              alt={commit.author}
              width={18}
              height={18}
              className="rounded-full flex-shrink-0"
            />
          ) : (
            <GitCommit className="w-[18px] h-[18px] text-sg-text3 flex-shrink-0" />
          )}
          <span className="text-xs text-sg-text1 truncate flex-1 group-hover:text-sg-text0 transition-colors">
            {commit.message}
          </span>
          <span className="text-[10px] font-mono text-sg-text3 flex-shrink-0">
            {commit.shortSha}
          </span>
          <span className="text-[10px] text-sg-text3 flex-shrink-0">
            {timeAgo(commit.date)}
          </span>
        </a>
      ))}
    </div>
  );
}
