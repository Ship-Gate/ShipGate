'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Check,
  X,
  ExternalLink,
  Download,
  RefreshCw,
  Clock,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AuditEvent } from '@/lib/types';
import { cn, formatTimestamp, formatDuration } from '@/lib/utils';

interface EventTimelineProps {
  events: AuditEvent[];
  loading: boolean;
}

export function EventTimeline({ events, loading }: EventTimelineProps) {
  if (events.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="text-4xl mb-4">📋</div>
        <p className="text-lg font-medium">No events found</p>
        <p className="text-sm">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {events.map((event) => (
        <EventRow key={event.id} event={event} />
      ))}
      {loading && (
        <>
          <EventRowSkeleton />
          <EventRowSkeleton />
          <EventRowSkeleton />
        </>
      )}
    </div>
  );
}

interface EventRowProps {
  event: AuditEvent;
}

function EventRow({ event }: EventRowProps) {
  const [expanded, setExpanded] = useState(false);

  const verdictVariant = {
    verified: 'success',
    risky: 'warning',
    unsafe: 'danger',
  }[event.verdict] as 'success' | 'warning' | 'danger';

  return (
    <div className="hover:bg-muted/50 transition-colors">
      {/* Row Header */}
      <div
        className="px-6 py-4 flex items-center gap-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Timestamp */}
        <div className="w-44 text-sm text-muted-foreground flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          {formatTimestamp(event.timestamp)}
        </div>

        {/* Verdict Badge */}
        <Badge variant={verdictVariant} className="w-20 justify-center">
          {event.verdict}
        </Badge>

        {/* Domain/Behavior */}
        <div className="flex-1 min-w-0">
          <span className="font-medium">{event.domain}</span>
          <span className="mx-2 text-muted-foreground">→</span>
          <span className="text-foreground/80">{event.behavior}</span>
        </div>

        {/* Actor */}
        <div className="w-40 text-sm flex items-center gap-2 truncate">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{event.actor.type}:</span>
          <span className="truncate">{event.actor.id}</span>
        </div>

        {/* Duration */}
        <div className="w-20 text-sm text-muted-foreground text-right">
          {formatDuration(event.duration)}
        </div>

        {/* Score */}
        <div className="w-16 text-sm text-right">
          <span
            className={cn(
              'font-medium',
              event.score >= 90 ? 'text-green-600' : event.score >= 70 ? 'text-yellow-600' : 'text-red-600'
            )}
          >
            {Math.round(event.score)}
          </span>
        </div>

        {/* Expand Icon */}
        <ChevronDown
          className={cn('h-5 w-5 text-muted-foreground transition-transform', expanded && 'rotate-180')}
        />
      </div>

      {/* Expanded Details */}
      {expanded && <EventDetails event={event} />}
    </div>
  );
}

function EventDetails({ event }: { event: AuditEvent }) {
  return (
    <div className="px-6 pb-4 bg-muted/30 border-t">
      <div className="grid grid-cols-2 gap-6 py-4">
        {/* Input */}
        <div>
          <h4 className="text-sm font-medium mb-2">Input</h4>
          <pre className="text-xs bg-background p-3 rounded-md border overflow-auto max-h-40 font-mono">
            {JSON.stringify(event.input, null, 2)}
          </pre>
        </div>

        {/* Output */}
        <div>
          <h4 className="text-sm font-medium mb-2">Output</h4>
          <pre className="text-xs bg-background p-3 rounded-md border overflow-auto max-h-40 font-mono">
            {JSON.stringify(event.output, null, 2)}
          </pre>
        </div>
      </div>

      {/* Checks */}
      <div className="py-4 border-t">
        <h4 className="text-sm font-medium mb-3">Verification Checks</h4>
        <div className="space-y-1.5">
          {event.checks.map((check, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {check.passed ? (
                <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
              ) : (
                <X className="h-4 w-4 text-red-500 flex-shrink-0" />
              )}
              <span className={cn(check.passed ? 'text-foreground/80' : 'text-red-700')}>
                <span className="text-muted-foreground mr-1">[{check.type}]</span>
                {check.name}
              </span>
              {!check.passed && check.error && (
                <span className="text-red-500 text-xs">— {check.error}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="pt-4 border-t flex gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/events/${event.id}`}>
            <ExternalLink className="h-4 w-4 mr-2" />
            View full details
          </Link>
        </Button>
        {event.proofBundleUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={event.proofBundleUrl} download>
              <Download className="h-4 w-4 mr-2" />
              Download proof bundle
            </a>
          </Button>
        )}
        <Button variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Replay verification
        </Button>
      </div>
    </div>
  );
}

function EventRowSkeleton() {
  return (
    <div className="px-6 py-4 flex items-center gap-4">
      <Skeleton className="h-4 w-44" />
      <Skeleton className="h-6 w-20 rounded-full" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-5 w-5" />
    </div>
  );
}
