'use client';

import { useGitHubStatus } from '@/hooks/use-integrations';
import { GitHubConnector } from '@/components/dashboard/github-connector';
import { GitHubPrList } from '@/components/dashboard/github-pr-list';
import { PageSkeleton } from '@/components/shared/skeleton';

export default function PrsPage() {
  const { data, isLoading } = useGitHubStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-sg-text0">
          Pull Requests
        </h1>
        <p className="text-sm text-sg-text3 mt-1">
          PR verifications and status
        </p>
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : !data?.connected ? (
        <GitHubConnector />
      ) : (
        <>
          <GitHubConnector compact />
          <GitHubPrList />
        </>
      )}
    </div>
  );
}
