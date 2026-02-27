'use client';

import { EmptyState } from '@/components/shared/empty-state';

export default function CompliancePanel() {
  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card">
      <EmptyState
        title="Compliance"
        description="Run SOC 2 compliance checks with `shipgate compliance soc2`."
      />
    </div>
  );
}
