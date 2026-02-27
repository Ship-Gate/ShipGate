'use client';

import { useProfile } from '@/hooks/use-data';
import { Skeleton } from '@/components/shared/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';

export function TeamPanel() {
  const { data, isLoading, error, refetch } = useProfile();

  if (isLoading) {
    return (
      <div className="bg-sg-bg1 border border-sg-border rounded-card p-5">
        <Skeleton className="h-4 w-20 mb-4" />
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2 w-24" />
          </div>
        </div>
        <Skeleton className="h-2 w-full" />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  if (!data) {
    return (
      <div className="bg-sg-bg1 border border-sg-border rounded-card">
        <EmptyState title="Team" description="Sign in to view your team information." />
      </div>
    );
  }

  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-sg-text0">Team</h3>
      </div>

      <div className="px-5 pb-4">
        <div className="flex items-center gap-3 mb-4">
          {data.avatar ? (
            <img
              src={data.avatar}
              alt={data.name ?? data.email}
              className="w-10 h-10 rounded-full border-2 border-sg-border"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-sg-bg3 flex items-center justify-center text-sm font-semibold text-sg-text1 border-2 border-sg-border">
              {(data.name ?? data.email).charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-xs font-semibold text-sg-text0">{data.name ?? data.email}</div>
            <div className="text-[10px] text-sg-text3">{data.email}</div>
            <div className="text-[10px] text-sg-text3 capitalize">via {data.provider}</div>
          </div>
        </div>

        {data.orgs.length > 0 ? (
          <div>
            <div className="text-[10px] text-sg-text3 uppercase tracking-wider mb-2">
              Organizations
            </div>
            <div className="space-y-1.5">
              {data.orgs.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-sg-bg2/30 border border-sg-border/50"
                >
                  <span className="text-[11px] text-sg-text0 font-medium">{org.name}</span>
                  <span className="text-[9px] text-sg-text3 uppercase">{org.role}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-sg-text3">No organizations</div>
        )}
      </div>

      <div className="px-5 pb-4 border-t border-sg-border pt-3">
        <div className="text-[10px] text-sg-text3">
          Member since {new Date(data.createdAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
