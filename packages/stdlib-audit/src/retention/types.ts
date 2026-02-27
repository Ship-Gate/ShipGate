// ============================================================================
// ISL Standard Library - Retention Types
// @stdlib/audit/retention/types
// ============================================================================

import type { EventCategory } from '../types.js';

// ============================================================================
// RETENTION POLICY
// ============================================================================

export interface RetentionPolicy {
  category: EventCategory;
  retention_days: number;
  archive_after_days?: number;
  compliance_standard?: string;
}

// ============================================================================
// PURGE RESULT
// ============================================================================

export interface PurgeResult {
  deleted: number;
  categories_processed: EventCategory[];
  errors: PurgeCategoryError[];
  started_at: Date;
  completed_at: Date;
}

export interface PurgeCategoryError {
  category: EventCategory;
  message: string;
}
