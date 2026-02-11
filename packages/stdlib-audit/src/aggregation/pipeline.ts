// ============================================================================
// ISL Standard Library - Aggregation Pipeline
// @stdlib/audit/aggregation/pipeline
// ============================================================================

import type { AuditEntry, Result, AuditError } from '../types.js';
import { Ok, Err } from '../types.js';
import type {
  PipelineStage,
  FilterStage,
  GroupStage,
  SortStage,
  LimitStage,
  AggregationGroup,
  AggregationResult,
  TimeWindow,
} from './types.js';

// ============================================================================
// PIPELINE BUILDER
// ============================================================================

export class AggregationPipeline {
  private stages: PipelineStage[] = [];

  filter(predicate: (entry: AuditEntry) => boolean): this {
    this.stages.push({ type: 'filter', predicate } as FilterStage);
    return this;
  }

  group(keyFn: (entry: AuditEntry) => string, label?: string): this {
    this.stages.push({ type: 'group', keyFn, label } as GroupStage);
    return this;
  }

  groupByField(field: keyof AuditEntry): this {
    return this.group((entry) => String(entry[field] ?? 'unknown'), field as string);
  }

  groupByTimeWindow(window: TimeWindow): this {
    return this.group((entry) => truncateToWindow(entry.timestamp, window), `time_${window}`);
  }

  sort(compareFn: (a: AggregationGroup, b: AggregationGroup) => number): this {
    this.stages.push({ type: 'sort', compareFn } as SortStage);
    return this;
  }

  sortByCount(direction: 'asc' | 'desc' = 'desc'): this {
    return this.sort((a, b) =>
      direction === 'desc' ? b.count - a.count : a.count - b.count,
    );
  }

  sortByKey(direction: 'asc' | 'desc' = 'asc'): this {
    return this.sort((a, b) =>
      direction === 'asc' ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key),
    );
  }

  limit(count: number): this {
    this.stages.push({ type: 'limit', count } as LimitStage);
    return this;
  }

  // ========================================================================
  // EXECUTION
  // ========================================================================

  execute(entries: AuditEntry[]): Result<AggregationResult, AuditError> {
    try {
      let filtered = entries;
      let groups: AggregationGroup[] | null = null;

      for (const stage of this.stages) {
        switch (stage.type) {
          case 'filter': {
            if (groups) {
              groups = groups.map((g) => ({
                ...g,
                entries: g.entries.filter(stage.predicate),
                count: g.entries.filter(stage.predicate).length,
              }));
            } else {
              filtered = filtered.filter(stage.predicate);
            }
            break;
          }
          case 'group': {
            const source = groups
              ? groups.flatMap((g) => g.entries)
              : filtered;
            groups = groupEntries(source, stage.keyFn);
            break;
          }
          case 'sort': {
            if (groups) {
              groups.sort(stage.compareFn);
            }
            break;
          }
          case 'limit': {
            if (groups) {
              groups = groups.slice(0, stage.count);
            } else {
              filtered = filtered.slice(0, stage.count);
            }
            break;
          }
        }
      }

      if (!groups) {
        groups = [{ key: 'all', count: filtered.length, entries: filtered }];
      }

      // Compute timestamps for each group
      for (const g of groups) {
        if (g.entries.length > 0) {
          const sorted = g.entries
            .map((e) => e.timestamp.getTime())
            .sort((a, b) => a - b);
          g.first_timestamp = new Date(sorted[0]!);
          g.last_timestamp = new Date(sorted[sorted.length - 1]!);
        }
      }

      return Ok({
        groups,
        total_entries: groups.reduce((sum, g) => sum + g.count, 0),
        total_groups: groups.length,
      });
    } catch (err) {
      return Err({
        code: 'AGGREGATION_FAILED',
        message: (err as Error).message,
      });
    }
  }

  async executeAsync(entries: AsyncIterable<AuditEntry>): Promise<Result<AggregationResult, AuditError>> {
    const collected: AuditEntry[] = [];
    for await (const entry of entries) {
      collected.push(entry);
    }
    return this.execute(collected);
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function groupEntries(
  entries: AuditEntry[],
  keyFn: (entry: AuditEntry) => string,
): AggregationGroup[] {
  const map = new Map<string, AuditEntry[]>();

  for (const entry of entries) {
    const key = keyFn(entry);
    const existing = map.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(key, [entry]);
    }
  }

  return Array.from(map.entries()).map(([key, groupEntries]) => ({
    key,
    count: groupEntries.length,
    entries: groupEntries,
  }));
}

function truncateToWindow(date: Date, window: TimeWindow): string {
  const d = new Date(date);
  switch (window) {
    case 'minute':
      d.setUTCSeconds(0, 0);
      return d.toISOString();
    case 'hour':
      d.setUTCMinutes(0, 0, 0);
      return d.toISOString();
    case 'day':
      d.setUTCHours(0, 0, 0, 0);
      return d.toISOString();
    case 'week': {
      const day = d.getUTCDay();
      d.setUTCDate(d.getUTCDate() - day);
      d.setUTCHours(0, 0, 0, 0);
      return d.toISOString();
    }
    case 'month':
      d.setUTCDate(1);
      d.setUTCHours(0, 0, 0, 0);
      return d.toISOString();
  }
}
