'use client';

import { Check, X, Clock, User, Shield, FileText, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AuditEvent } from '@/lib/types';
import { cn, formatTimestamp, formatDuration, copyToClipboard } from '@/lib/utils';

interface EventDetailProps {
  event: AuditEvent | null;
  loading: boolean;
}

export function EventDetail({ event, loading }: EventDetailProps) {
  if (loading) {
    return <EventDetailSkeleton />;
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Event not found
      </div>
    );
  }

  const verdictVariant = {
    verified: 'success',
    risky: 'warning',
    unsafe: 'danger',
  }[event.verdict] as 'success' | 'warning' | 'danger';

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant={verdictVariant} className="text-sm px-3 py-1">
              {event.verdict}
            </Badge>
            <span className="text-2xl font-semibold">
              {event.domain} → {event.behavior}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatTimestamp(event.timestamp)}
            </span>
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {event.actor.type}: {event.actor.id}
            </span>
            <span>Duration: {formatDuration(event.duration)}</span>
            <span
              className={cn(
                'font-medium',
                event.score >= 90 ? 'text-green-600' : event.score >= 70 ? 'text-yellow-600' : 'text-red-600'
              )}
            >
              Score: {Math.round(event.score)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(event.id)}
          >
            Copy ID
          </Button>
          {event.proofBundleUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={event.proofBundleUrl} download>
                <Download className="h-4 w-4 mr-2" />
                Proof Bundle
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Event ID */}
      <div className="p-3 bg-muted rounded-md">
        <span className="text-xs text-muted-foreground">Event ID:</span>
        <code className="ml-2 text-sm font-mono">{event.id}</code>
      </div>

      {/* Input/Output */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Input
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-64 font-mono">
              {JSON.stringify(event.input, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Output
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-64 font-mono">
              {JSON.stringify(event.output, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      {/* Error (if any) */}
      {event.error && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="py-3">
            <CardTitle className="text-base text-red-800 flex items-center gap-2">
              <X className="h-4 w-4" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-red-700">
              <span className="font-medium">{event.error.code}:</span> {event.error.message}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verification Checks */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Verification Checks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {event.checks.map((check, i) => (
              <div key={i} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {check.passed ? (
                      <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                        <Check className="h-4 w-4 text-green-600" />
                      </div>
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center">
                        <X className="h-4 w-4 text-red-600" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium">{check.name}</div>
                      <div className="text-xs text-muted-foreground">
                        <Badge variant="outline" className="mr-2">
                          {check.type}
                        </Badge>
                        <code className="font-mono">{check.expression}</code>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {check.duration}ms
                  </div>
                </div>
                {!check.passed && check.error && (
                  <div className="mt-2 ml-9 p-2 bg-red-50 rounded text-sm text-red-700">
                    {check.error}
                  </div>
                )}
                {!check.passed && check.expected !== undefined && (
                  <div className="mt-2 ml-9 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Expected:</span>
                      <pre className="mt-1 p-2 bg-muted rounded font-mono text-xs">
                        {JSON.stringify(check.expected, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Actual:</span>
                      <pre className="mt-1 p-2 bg-muted rounded font-mono text-xs">
                        {JSON.stringify(check.actual, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      {event.metadata && Object.keys(event.metadata).length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-md overflow-auto font-mono">
              {JSON.stringify(event.metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Trace IDs */}
      {(event.traceId || event.spanId) && (
        <div className="flex gap-4 text-sm">
          {event.traceId && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Trace ID:</span>
              <code className="font-mono bg-muted px-2 py-1 rounded">{event.traceId}</code>
            </div>
          )}
          {event.spanId && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Span ID:</span>
              <code className="font-mono bg-muted px-2 py-1 rounded">{event.spanId}</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventDetailSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}
