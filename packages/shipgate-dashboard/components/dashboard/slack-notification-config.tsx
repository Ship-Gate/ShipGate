'use client';

import { useState } from 'react';
import { useSlackStatus, useSlackChannels } from '@/hooks/use-integrations';
import type { SlackRule } from '@/hooks/use-integrations';
import { apiClient } from '@/lib/api-client';
import { Skeleton } from '@/components/shared/skeleton';
import { Bell, Trash2, Plus } from 'lucide-react';

const EVENT_LABELS: Record<string, string> = {
  'run.completed': 'Run completed',
  'verdict.no_ship': 'NO_SHIP verdict',
  'finding.critical': 'Critical finding',
};

function RuleRow({
  rule,
  onDelete,
  onToggle,
}: {
  rule: SlackRule;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-sg-bg2 border border-sg-border">
      <div className="flex items-center gap-3">
        <Bell className="w-3.5 h-3.5 text-sg-text3" />
        <div>
          <span className="text-xs font-medium text-sg-text0">
            #{rule.channelName}
          </span>
          <span className="text-xs text-sg-text3 ml-2">
            {EVENT_LABELS[rule.event] ?? rule.event}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className={`w-8 h-4 rounded-full relative transition-colors ${
            rule.enabled ? 'bg-sg-ship' : 'bg-sg-bg3'
          }`}
        >
          <div
            className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${
              rule.enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-sg-noship-bg text-sg-text3 hover:text-sg-noship transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function SlackNotificationConfig() {
  const { data: status, isLoading: statusLoading, refetch } = useSlackStatus();
  const { data: channelData, isLoading: channelsLoading } = useSlackChannels();
  const [selectedChannel, setSelectedChannel] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('run.completed');
  const [adding, setAdding] = useState(false);

  if (statusLoading) {
    return <Skeleton className="h-32 w-full rounded-card" />;
  }

  if (!status?.connected) return null;

  const channels = channelData?.channels ?? [];
  const rules = status.rules;

  async function handleAdd() {
    if (!selectedChannel) return;
    const ch = channels.find((c) => c.id === selectedChannel);
    if (!ch) return;

    setAdding(true);
    try {
      await apiClient.post('/api/v1/integrations/slack/rules', {
        channelId: ch.id,
        channelName: ch.name,
        event: selectedEvent,
      });
      refetch();
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(ruleId: string) {
    await apiClient.delete(`/api/v1/integrations/slack/rules/${ruleId}`);
    refetch();
  }

  async function handleToggle(rule: SlackRule) {
    await fetch(`/api/v1/integrations/slack/rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !rule.enabled }),
      credentials: 'same-origin',
    });
    refetch();
  }

  return (
    <div className="bg-sg-bg1 border border-sg-border rounded-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-sg-text0 mb-1">
          Notification Rules
        </h3>
        <p className="text-[11px] text-sg-text3">
          Choose which events send alerts to your Slack channels.
        </p>
      </div>

      {rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              onDelete={() => handleDelete(rule.id)}
              onToggle={() => handleToggle(rule)}
            />
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 pt-2 border-t border-sg-border">
        <div className="flex-1">
          <label className="text-[10px] text-sg-text3 uppercase tracking-wider block mb-1">
            Channel
          </label>
          {channelsLoading ? (
            <Skeleton className="h-8 w-full rounded-md" />
          ) : (
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full h-8 bg-sg-bg2 border border-sg-border rounded-md px-2 text-xs text-sg-text0 focus:outline-none focus:border-sg-accent"
            >
              <option value="">Select channel...</option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  #{ch.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-sg-text3 uppercase tracking-wider block mb-1">
            Event
          </label>
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="w-full h-8 bg-sg-bg2 border border-sg-border rounded-md px-2 text-xs text-sg-text0 focus:outline-none focus:border-sg-accent"
          >
            {Object.entries(EVENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleAdd}
          disabled={!selectedChannel || adding}
          className="h-8 px-3 rounded-md bg-sg-accent text-white text-xs font-medium hover:bg-sg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>
    </div>
  );
}
