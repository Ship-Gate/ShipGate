'use client';

import { Calendar, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useDomains, useBehaviors } from '@/hooks/useAuditLog';
import type { AuditFilters, Verdict, DateRange } from '@/lib/types';
import { countActiveFilters, getDateRangeFromPreset, type DateRangePreset } from '@/lib/filters';

interface FilterPanelProps {
  filters: AuditFilters;
  onFiltersChange: (filters: Partial<AuditFilters>) => void;
  onReset: () => void;
}

export function FilterPanel({ filters, onFiltersChange, onReset }: FilterPanelProps) {
  const { domains } = useDomains();
  const { behaviors } = useBehaviors(filters.domain ?? undefined);
  const activeCount = countActiveFilters(filters);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Domain Filter */}
      <Select
        value={filters.domain ?? 'all'}
        onValueChange={(value) => onFiltersChange({ domain: value === 'all' ? null : value, behavior: null })}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Domain" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Domains</SelectItem>
          {domains.map((domain) => (
            <SelectItem key={domain} value={domain}>
              {domain}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Behavior Filter */}
      <Select
        value={filters.behavior ?? 'all'}
        onValueChange={(value) => onFiltersChange({ behavior: value === 'all' ? null : value })}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Behavior" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Behaviors</SelectItem>
          {behaviors.map((behavior) => (
            <SelectItem key={behavior} value={behavior}>
              {behavior}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Verdict Filter */}
      <Select
        value={filters.verdict ?? 'all'}
        onValueChange={(value) => onFiltersChange({ verdict: value === 'all' ? null : value as Verdict })}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Verdict" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Verdicts</SelectItem>
          <SelectItem value="verified">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Verified
            </span>
          </SelectItem>
          <SelectItem value="risky">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-yellow-500" />
              Risky
            </span>
          </SelectItem>
          <SelectItem value="unsafe">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Unsafe
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Date Range Filter */}
      <DateRangeFilter
        value={filters.dateRange}
        onChange={(dateRange) => onFiltersChange({ dateRange })}
      />

      {/* Active Filters Badge & Reset */}
      {activeCount > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Filter className="h-3 w-3" />
            {activeCount} active
          </Badge>
          <Button variant="ghost" size="sm" onClick={onReset} className="h-8 px-2">
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
}

function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const presets: { label: string; value: DateRangePreset }[] = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 7 days', value: 'last7days' },
    { label: 'Last 30 days', value: 'last30days' },
    { label: 'This month', value: 'thisMonth' },
    { label: 'Last month', value: 'lastMonth' },
  ];

  const getCurrentPreset = (): string => {
    if (!value.start && !value.end) return 'all';
    // Could add logic to detect preset from date range
    return 'custom';
  };

  return (
    <Select
      value={getCurrentPreset()}
      onValueChange={(preset) => {
        if (preset === 'all') {
          onChange({ start: null, end: null });
        } else {
          onChange(getDateRangeFromPreset(preset as DateRangePreset));
        }
      }}
    >
      <SelectTrigger className="w-40">
        <Calendar className="h-4 w-4 mr-2" />
        <SelectValue placeholder="Date range" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All time</SelectItem>
        {presets.map((preset) => (
          <SelectItem key={preset.value} value={preset.value}>
            {preset.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
