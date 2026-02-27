'use client';

import { EmptyState } from '@/components/shared/empty-state';

export default function TeamActivity() {
  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card">
      <EmptyState
        title="Team Activity"
        description="Team activity will appear after team members run scans."
      />
    </div>
  );
}
