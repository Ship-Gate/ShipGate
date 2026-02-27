'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/SearchBar';
import { FilterPanel } from '@/components/FilterPanel';
import { EventTimeline } from '@/components/EventTimeline';
import { ExportButton } from '@/components/ExportButton';
import { useAuditLog } from '@/hooks/useAuditLog';
import { DEFAULT_FILTERS } from '@/lib/filters';
import { formatNumber } from '@/lib/utils';

export default function AuditLogPage() {
  const {
    events,
    loading,
    hasMore,
    total,
    filters,
    loadMore,
    refresh,
    setFilters,
    resetFilters,
  } = useAuditLog(DEFAULT_FILTERS);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="h-16 border-b flex items-center px-6 justify-between bg-background">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Audit Log</h1>
          {total > 0 && (
            <span className="text-sm text-muted-foreground">
              {formatNumber(total)} events
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <ExportButton filters={filters} />
        </div>
      </header>

      {/* Search & Filters */}
      <div className="border-b px-6 py-3 bg-muted/30 space-y-3">
        <div className="flex items-center gap-4">
          <SearchBar
            value={filters.search}
            onChange={(search) => setFilters({ search })}
          />
        </div>
        <FilterPanel
          filters={filters}
          onFiltersChange={setFilters}
          onReset={resetFilters}
        />
      </div>

      {/* Event Timeline */}
      <div className="flex-1 overflow-auto">
        <EventTimeline events={events} loading={loading} />

        {/* Load More */}
        {hasMore && !loading && (
          <div className="p-4 border-t">
            <Button
              variant="outline"
              onClick={loadMore}
              className="w-full"
            >
              Load more events
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
