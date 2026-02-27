'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EventDetail } from '@/components/EventDetail';
import { useAuditEvent } from '@/hooks/useAuditLog';

interface EventPageProps {
  params: {
    id: string;
  };
}

export default function EventPage({ params }: EventPageProps) {
  const { event, loading, error } = useAuditEvent(params.id);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="h-16 border-b flex items-center px-6 bg-background">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Audit Log
          </Link>
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {error ? (
          <div className="p-6 text-center text-red-600">
            <p className="text-lg font-medium">Error loading event</p>
            <p className="text-sm mt-1">{error.message}</p>
          </div>
        ) : (
          <EventDetail event={event} loading={loading} />
        )}
      </div>
    </div>
  );
}
