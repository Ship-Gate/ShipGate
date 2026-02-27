'use client';

import { EmptyState } from '@/components/shared/empty-state';

export default function ProvenancePanel() {
  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card">
      <EmptyState
        title="Code Provenance"
        description="Provenance tracking will be available after scanning."
      />
    </div>
  );
}
