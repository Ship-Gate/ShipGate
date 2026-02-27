'use client';

import { useSlackStatus } from '@/hooks/use-integrations';
import { Skeleton } from '@/components/shared/skeleton';
import { apiClient } from '@/lib/api-client';
import { MessageSquare, Unplug } from 'lucide-react';

export function SlackConnector({ compact = false }: { compact?: boolean }) {
  const { data, isLoading, refetch } = useSlackStatus();

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
            <MessageSquare className="w-4 h-4 text-sg-text2" />
          </div>
          <div>
            <div className="text-sm font-medium text-sg-text0">Slack</div>
            <div className="text-[11px] text-sg-text3">Not connected</div>
          </div>
        </div>
        {!compact && (
          <p className="text-xs text-sg-text3 mb-3">
            Connect Slack to receive notifications for runs, verdicts, and critical findings.
          </p>
        )}
        <a
          href="/api/integrations/slack/connect"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-sg-bg3 text-sg-text0 hover:bg-sg-border-hover transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Connect Slack
        </a>
      </div>
    );
  }

  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-[#4A154B] flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-sg-ship border-2 border-sg-bg1" />
          </div>
          <div>
            <div className="text-sm font-medium text-sg-text0">
              {data.connection!.teamName}
            </div>
            <div className="text-[11px] text-sg-text3">
              Slack connected · {data.rules.length} rule{data.rules.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <button
          onClick={async () => {
            await apiClient.post('/api/integrations/slack/disconnect', {});
            refetch();
          }}
          className="p-1.5 rounded-md hover:bg-sg-noship-bg text-sg-text3 hover:text-sg-noship transition-colors"
          title="Disconnect"
        >
          <Unplug className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
