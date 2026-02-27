'use client';

import { EmptyState } from '@/components/shared/empty-state';

export function PrMonitor() {
  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card">
      <EmptyState
        title="Pull Requests"
        description="Connect GitHub to see PR verifications."
      />
    </div>
  );
}
