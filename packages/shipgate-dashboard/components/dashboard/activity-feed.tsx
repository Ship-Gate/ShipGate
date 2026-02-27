'use client';

import { useActivity } from '@/hooks/use-activity';
import { Skeleton } from '@/components/shared/skeleton';
import {
  Play,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  Shield,
} from 'lucide-react';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function ActivityIcon({ type, meta }: { type: string; meta: Record<string, unknown> }) {
  if (type === 'run') {
    const verdict = meta.verdict as string | null;
    if (verdict === 'SHIP')
      return <CheckCircle className="w-3.5 h-3.5 text-sg-ship" />;
    if (verdict === 'WARN')
      return <AlertTriangle className="w-3.5 h-3.5 text-sg-warn" />;
    if (verdict === 'NO_SHIP')
      return <XCircle className="w-3.5 h-3.5 text-sg-noship" />;
    return <Play className="w-3.5 h-3.5 text-sg-accent" />;
  }
  if (type === 'finding')
    return <FileText className="w-3.5 h-3.5 text-sg-high-sev" />;
  return <Shield className="w-3.5 h-3.5 text-sg-text3" />;
}

export function ActivityFeed({ limit = 12 }: { limit?: number }) {
  const { data, isLoading } = useActivity(limit);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="w-4 h-4 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="text-xs text-sg-text3 py-6 text-center">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-start gap-3 relative">
          {idx < items.length - 1 && (
            <div className="absolute left-[7px] top-5 bottom-0 w-px bg-sg-border" />
          )}
          <div className="mt-0.5 relative z-10 bg-sg-bg1 p-0.5">
            <ActivityIcon type={item.type} meta={item.meta} />
          </div>
          <div className="flex-1 pb-4 min-w-0">
            <p className="text-xs text-sg-text1 leading-tight">{item.title}</p>
            {item.subtitle && (
              <p className="text-[11px] text-sg-text3 mt-0.5">
                {item.subtitle}
              </p>
            )}
            <p className="text-[10px] text-sg-text3 mt-0.5">
              {timeAgo(item.timestamp)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
