'use client';

import { EmptyState } from '@/components/shared/empty-state';

export function WebhookConfig() {
  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card">
      <EmptyState
        title="Webhooks"
        description="Webhook configuration will be available soon."
      />
    </div>
  );
}
