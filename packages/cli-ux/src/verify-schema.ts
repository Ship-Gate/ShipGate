/**
 * Verification JSON Schema
 *
 * Zod schemas for validating verification JSON output structure.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Base Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const ClauseVerdictSchema = z.enum(['TRUE', 'FALSE', 'UNKNOWN']);

export const OverallVerdictSchema = z.enum(['PROVEN', 'INCOMPLETE_PROOF', 'FAILED']);

export const VerifyClauseTypeSchema = z.enum([
  'postcondition',
  'precondition',
  'invariant',
  'temporal',
  'security',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Evidence Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const TraceSliceRefSchema = z.object({
  type: z.literal('trace_slice'),
  behavior: z.string(),
  eventIds: z.array(z.string()),
  startMs: z.number(),
  endMs: z.number(),
  traceFile: z.string().optional(),
});

export const AdapterSnapshotRefSchema = z.object({
  type: z.literal('adapter_snapshot'),
  adapter: z.string(),
  snapshotId: z.string(),
  timestampMs: z.number(),
  snapshotFile: z.string().optional(),
});

export const NoEvidenceRefSchema = z.object({
  type: z.literal('none'),
  reason: z.string(),
});

export const EvidenceRefSchema = z.discriminatedUnion('type', [
  TraceSliceRefSchema,
  AdapterSnapshotRefSchema,
  NoEvidenceRefSchema,
]);

// ─────────────────────────────────────────────────────────────────────────────
// Unknown Reason Schema
// ─────────────────────────────────────────────────────────────────────────────

export const UnknownReasonCodeSchema = z.enum([
  'NO_TRACE_DATA',
  'EVALUATION_ERROR',
  'MISSING_CONTEXT',
  'NON_BOOLEAN_RESULT',
  'TIMEOUT',
  'ADAPTER_UNAVAILABLE',
  'STATE_NOT_CAPTURED',
]);

export const UnknownReasonSchema = z.object({
  code: UnknownReasonCodeSchema,
  message: z.string(),
  remediation: z.string(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Source Location Schema
// ─────────────────────────────────────────────────────────────────────────────

export const SourceLocationSchema = z.object({
  file: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().positive(),
  endLine: z.number().int().positive().optional(),
  endColumn: z.number().int().positive().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Clause Result Schema
// ─────────────────────────────────────────────────────────────────────────────

export const VerifyClauseResultSchema = z.object({
  clauseId: z.string().min(1),
  clauseText: z.string().min(1),
  clauseType: VerifyClauseTypeSchema,
  behavior: z.string().optional(),
  verdict: ClauseVerdictSchema,
  evidence: EvidenceRefSchema,
  source: SourceLocationSchema,
  unknownReason: UnknownReasonSchema.optional(),
  failureMessage: z.string().optional(),
  expected: z.unknown().optional(),
  actual: z.unknown().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary Schema
// ─────────────────────────────────────────────────────────────────────────────

export const VerifySummarySchema = z.object({
  total: z.number().int().min(0),
  proven: z.number().int().min(0),
  failed: z.number().int().min(0),
  unknown: z.number().int().min(0),
});

// ─────────────────────────────────────────────────────────────────────────────
// Verification Result Schema
// ─────────────────────────────────────────────────────────────────────────────

export const VerifyResultSchema = z.object({
  verdict: OverallVerdictSchema,
  specName: z.string().min(1),
  specFile: z.string().min(1),
  clauses: z.array(VerifyClauseResultSchema),
  summary: VerifySummarySchema,
  durationMs: z.number().min(0),
  timestamp: z.string().datetime(),
});

// ─────────────────────────────────────────────────────────────────────────────
// JSON Output Schema
// ─────────────────────────────────────────────────────────────────────────────

export const VerifyJsonOutputMetaSchema = z.object({
  cliVersion: z.string(),
  nodeVersion: z.string(),
  platform: z.string(),
  timestamp: z.string().datetime(),
});

export const VerifyJsonOutputSchema = z.object({
  schemaVersion: z.literal('1.0'),
  verdict: OverallVerdictSchema,
  exitCode: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  result: VerifyResultSchema,
  meta: VerifyJsonOutputMetaSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validation result type
 */
export interface VerifyValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: z.ZodError;
}

/**
 * Validate verify JSON output against schema
 */
export function validateVerifyJsonOutput(
  data: unknown
): VerifyValidationResult<z.infer<typeof VerifyJsonOutputSchema>> {
  const result = VerifyJsonOutputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Validate verify result against schema
 */
export function validateVerifyResult(
  data: unknown
): VerifyValidationResult<z.infer<typeof VerifyResultSchema>> {
  const result = VerifyResultSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Get human-readable validation errors
 */
export function formatVerifyValidationErrors(errors: z.ZodError): string[] {
  return errors.errors.map((err) => {
    const path = err.path.join('.');
    return `${path}: ${err.message}`;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Exports
// ─────────────────────────────────────────────────────────────────────────────

export type ClauseVerdictSchemaType = z.infer<typeof ClauseVerdictSchema>;
export type OverallVerdictSchemaType = z.infer<typeof OverallVerdictSchema>;
export type EvidenceRefSchemaType = z.infer<typeof EvidenceRefSchema>;
export type VerifyClauseResultSchemaType = z.infer<typeof VerifyClauseResultSchema>;
export type VerifySummarySchemaType = z.infer<typeof VerifySummarySchema>;
export type VerifyResultSchemaType = z.infer<typeof VerifyResultSchema>;
export type VerifyJsonOutputSchemaType = z.infer<typeof VerifyJsonOutputSchema>;
