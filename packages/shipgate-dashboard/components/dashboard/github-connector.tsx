'use client';

import { useGitHubStatus, useGitHubDisconnect } from '@/hooks/use-integrations';
import { Skeleton } from '@/components/shared/skeleton';
import { Github, ExternalLink, Unplug } from 'lucide-react';
import Image from 'next/image';

export function GitHubConnector({ compact = false }: { compact?: boolean }) {
  const { data, isLoading, refetch } = useGitHubStatus();
  const disconnect = useGitHubDisconnect();

  if (isLoading) {
    return (
      <div className="bg-sg-bg1 border border-sg-border rounded-card p-4">
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!data?.connected) {
    return (
      <div className="bg-sg-bg1 border border-sg-border rounded-card p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-sg-bg3 flex items-center justify-center">
            <Github className="w-4 h-4 text-sg-text2" />
          </div>
          <div>
            <div className="text-sm font-medium text-sg-text0">GitHub</div>
            <div className="text-[11px] text-sg-text3">Not connected</div>
          </div>
        </div>
        {!compact && (
          <p className="text-xs text-sg-text3 mb-3">
            Connect GitHub to view repos, pull requests, and commit activity.
          </p>
        )}
        <a
          href="/api/integrations/github/connect"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-sg-bg3 text-sg-text0 hover:bg-sg-border-hover transition-colors"
        >
          <Github className="w-3.5 h-3.5" />
          Connect GitHub
        </a>
      </div>
    );
  }

  const conn = data.connections[0];

  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            {conn.avatarUrl ? (
              <Image
                src={conn.avatarUrl}
                alt={conn.login}
                width={32}
                height={32}
                className="rounded-lg"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-sg-bg3 flex items-center justify-center">
                <Github className="w-4 h-4 text-sg-text2" />
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-sg-ship border-2 border-sg-bg1" />
          </div>
          <div>
            <div className="text-sm font-medium text-sg-text0">
              {conn.login}
            </div>
            <div className="text-[11px] text-sg-text3">GitHub connected</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`https://github.com/${conn.login}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md hover:bg-sg-bg3 text-sg-text3 hover:text-sg-text1 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={async () => {
              await disconnect(conn.id);
              refetch();
            }}
            className="p-1.5 rounded-md hover:bg-sg-noship-bg text-sg-text3 hover:text-sg-noship transition-colors"
            title="Disconnect"
          >
            <Unplug className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
