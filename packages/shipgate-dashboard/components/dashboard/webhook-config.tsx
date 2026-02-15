import { SectionCard } from '@/components/shared/section-card';
import { webhooks } from '@/lib/mock-data';

export function WebhookConfig() {
  return (
    <SectionCard
      title="Webhooks & Alerts"
      subtitle="Notifications"
      extra={
        <button
          type="button"
          className="py-1 px-2.5 rounded border border-sg-border bg-transparent text-[10px] text-sg-text2 cursor-pointer hover:text-sg-text1 transition-colors"
        >
          + Add webhook
        </button>
      }
    >
      {webhooks.map((h) => (
        <div
          key={h.id}
          className="flex items-center gap-2.5 py-2 px-[18px] border-b border-sg-border"
        >
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background: h.status === 'active' ? '#00e68a' : '#555566',
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-sg-text0 font-mono">
              {h.event}
            </div>
            <div className="text-[10px] text-sg-text3 mt-0.5 truncate">
              {h.url}
            </div>
          </div>
          <span className="text-[9px] text-sg-text3 shrink-0">
            {h.lastFired}
          </span>
        </div>
      ))}
    </SectionCard>
  );
}
