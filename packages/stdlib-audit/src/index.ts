// ============================================================================
// ISL Standard Library - Audit
// @stdlib/audit
// ============================================================================

// Core types & Result
export type {
  Result,
  AuditError,
  RecordError,
  QueryError,
  ComplianceError,
  RetentionError,
  AuditEntry,
  AuditEntryId,
  ActorId,
  ResourceId,
  Actor,
  Resource,
  Source,
  Change,
  RecordInput,
  AuditStore,
  StoreQueryFilters,
} from './types.js';
export { Ok, Err, EventCategory, EventOutcome, ActorType } from './types.js';

// Errors
export {
  invalidInput,
  invalidTimestamp,
  duplicateEntry,
  storageError,
  rateLimited,
  invalidQuery,
  invalidDateRange,
  queryTimeout,
  ruleEvaluationFailed,
  invalidRule,
  reportGenerationFailed,
  purgeFailed,
  invalidPolicy,
  policyConflict,
} from './errors.js';

// Trail
export { createEntry, type EntryOptions } from './trail/entry.js';
export { AuditTracker, type TrackerOptions } from './trail/tracker.js';
export { InMemoryAuditStore } from './trail/store.js';
export { AuditQueryBuilder } from './trail/query.js';

// Compliance
export type {
  ComplianceRule,
  RuleSeverity,
  RuleResult,
  ComplianceReport,
  ReportSummary,
} from './compliance/types.js';
export { ComplianceChecker } from './compliance/checker.js';
export {
  createRule,
  noGapsInAuthEvents,
  allEntriesHaveHash,
  failedLoginThreshold,
  adminActionsHaveResource,
  dataModificationsHaveChanges,
  securityEventsHaveActor,
  SOC2_RULES,
  PCI_DSS_RULES,
  SOX_RULES,
  ALL_BUILT_IN_RULES,
} from './compliance/rules.js';
export { generateReport, type ReportOptions } from './compliance/report.js';

// Aggregation
export type {
  AggregationGroup,
  AggregationResult,
  TimeWindow,
  TimeWindowGroup,
  PipelineStage,
  FilterStage,
  GroupStage,
  SortStage,
  LimitStage,
} from './aggregation/types.js';
export { AggregationPipeline } from './aggregation/pipeline.js';
export { Aggregator } from './aggregation/aggregator.js';

// Retention
export type {
  RetentionPolicy,
  PurgeResult,
  PurgeCategoryError,
} from './retention/types.js';
export {
  DEFAULT_RETENTION_POLICIES,
  getPolicyForCategory,
  calculateRetentionDate,
} from './retention/policy.js';
export { RetentionEnforcer } from './retention/enforcer.js';
