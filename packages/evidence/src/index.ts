/**
 * @isl-lang/evidence
 *
 * Evidence schema with zod validation and stable canonical serialization
 * for ISL verification reports.
 *
 * @example
 * ```typescript
 * import { validateEvidenceReport, serialize, EvidenceReport } from '@isl-lang/evidence';
 *
 * // Validate incoming JSON data
 * const report = validateEvidenceReport(jsonData);
 *
 * // Serialize for storage
 * const json = serialize(report);
 *
 * // Compute content hash
 * const hash = await computeHash(report);
 * ```
 */

// Types
export type {
  Verdict,
  ClauseStatus,
  SourceLocation,
  EvidenceItem,
  ClauseResult,
  Assumption,
  OpenQuestion,
  ReproCommand,
  VerificationSummary,
  VerificationMetadata,
  EvidenceReport,
} from './types.js';

// Schemas
export {
  VerdictSchema,
  ClauseStatusSchema,
  SourceLocationSchema,
  EvidenceItemSchema,
  ClauseResultSchema,
  AssumptionSchema,
  OpenQuestionSchema,
  ReproCommandSchema,
  VerificationSummarySchema,
  VerificationMetadataSchema,
  EvidenceReportSchema,
  validateEvidenceReport,
  safeValidateEvidenceReport,
  validatePartialReport,
} from './schema.js';

// Serialization
export {
  serialize,
  deserialize,
  computeHash,
  areEqual,
  diff,
  stripTimestamps,
  type SerializeOptions,
  type ReportDiff,
  type ClauseChange,
} from './serialize.js';

// Builder helpers for creating reports programmatically
export { createReport, createClause, createEvidence } from './builder.js';
