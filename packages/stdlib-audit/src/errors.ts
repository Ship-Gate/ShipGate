// ============================================================================
// ISL Standard Library - Audit Errors
// @stdlib/audit/errors
// ============================================================================

import type { RecordError, QueryError, ComplianceError, RetentionError } from './types.js';

// ============================================================================
// ERROR FACTORIES
// ============================================================================

export function invalidInput(field: string, reason: string): RecordError {
  return { code: 'INVALID_INPUT', message: `Invalid ${field}: ${reason}`, field };
}

export function invalidTimestamp(): RecordError {
  return { code: 'INVALID_TIMESTAMP', message: 'Timestamp cannot be in the future' };
}

export function duplicateEntry(key: string): RecordError {
  return { code: 'DUPLICATE_ENTRY', message: `Duplicate entry with idempotency key: ${key}` };
}

export function storageError(message: string): RecordError {
  return { code: 'STORAGE_ERROR', message, retriable: true };
}

export function rateLimited(): RecordError {
  return { code: 'RATE_LIMITED', message: 'Rate limit exceeded', retriable: true };
}

export function invalidQuery(field: string, reason: string): QueryError {
  return { code: 'INVALID_QUERY', message: `Invalid query ${field}: ${reason}` };
}

export function invalidDateRange(reason: string): QueryError {
  return { code: 'INVALID_DATE_RANGE', message: reason };
}

export function queryTimeout(): QueryError {
  return { code: 'QUERY_TIMEOUT', message: 'Query timed out', retriable: true };
}

export function ruleEvaluationFailed(rule: string, reason: string): ComplianceError {
  return { code: 'RULE_EVALUATION_FAILED', message: `Rule "${rule}" failed: ${reason}` };
}

export function invalidRule(reason: string): ComplianceError {
  return { code: 'INVALID_RULE', message: reason };
}

export function reportGenerationFailed(reason: string): ComplianceError {
  return { code: 'REPORT_GENERATION_FAILED', message: reason };
}

export function purgeFailed(reason: string): RetentionError {
  return { code: 'PURGE_FAILED', message: reason, retriable: true };
}

export function invalidPolicy(reason: string): RetentionError {
  return { code: 'INVALID_POLICY', message: reason };
}

export function policyConflict(reason: string): RetentionError {
  return { code: 'POLICY_CONFLICT', message: reason };
}
