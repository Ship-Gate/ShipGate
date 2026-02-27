'use client';

import { EmptyState } from '@/components/shared/empty-state';

export function DeploymentGate() {
  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card">
      <EmptyState
        title="Deployment Gates"
        description="No deployment gates configured."
      />
    </div>
  );
}
