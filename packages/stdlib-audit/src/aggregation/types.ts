// ============================================================================
// ISL Standard Library - Aggregation Types
// @stdlib/audit/aggregation/types
// ============================================================================

import type { AuditEntry } from '../types.js';

// ============================================================================
// PIPELINE TYPES
// ============================================================================

export interface AggregationStage {
  type: 'filter' | 'group' | 'sort' | 'limit';
}

export interface FilterStage extends AggregationStage {
  type: 'filter';
  predicate: (entry: AuditEntry) => boolean;
}

export interface GroupStage extends AggregationStage {
  type: 'group';
  keyFn: (entry: AuditEntry) => string;
  label?: string;
}

export interface SortStage extends AggregationStage {
  type: 'sort';
  compareFn: (a: AggregationGroup, b: AggregationGroup) => number;
}

export interface LimitStage extends AggregationStage {
  type: 'limit';
  count: number;
}

export type PipelineStage = FilterStage | GroupStage | SortStage | LimitStage;

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface AggregationGroup {
  key: string;
  count: number;
  entries: AuditEntry[];
  first_timestamp?: Date;
  last_timestamp?: Date;
}

export interface AggregationResult {
  groups: AggregationGroup[];
  total_entries: number;
  total_groups: number;
}

// ============================================================================
// TIME WINDOW
// ============================================================================

export type TimeWindow = 'minute' | 'hour' | 'day' | 'week' | 'month';

export interface TimeWindowGroup extends AggregationGroup {
  window_start: Date;
  window_end: Date;
}
