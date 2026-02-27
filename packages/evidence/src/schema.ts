/**
 * Zod Validation Schemas
 *
 * Runtime validation schemas for evidence types.
 * Use these to validate JSON data before use.
 */

import { z } from 'zod';

/**
 * Schema for verification verdict
 */
export const VerdictSchema = z.enum(['SHIP', 'NO_SHIP']);

/**
 * Schema for clause status
 */
export const ClauseStatusSchema = z.enum(['PASS', 'PARTIAL', 'FAIL']);

/**
 * Schema for source location
 */
export const SourceLocationSchema = z.object({
  file: z.string().min(1),
  line: z.number().int().positive(),
  column: z.number().int().positive().optional(),
  snippet: z.string().optional(),
});

/**
 * Schema for evidence item
 */
export const EvidenceItemSchema = z.object({
  type: z.enum(['assertion', 'invariant', 'precondition', 'postcondition', 'trace', 'log']),
  description: z.string().min(1),
  location: SourceLocationSchema.optional(),
  value: z.unknown().optional(),
  collectedAt: z.string().datetime().optional(),
});

/**
 * Schema for clause result
 */
export const ClauseResultSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: ClauseStatusSchema,
  description: z.string().optional(),
  evidence: z.array(EvidenceItemSchema),
  durationMs: z.number().nonnegative().optional(),
  error: z.string().optional(),
});

/**
 * Schema for assumption
 */
export const AssumptionSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  rationale: z.string().optional(),
  risk: z.enum(['low', 'medium', 'high']),
});

/**
 * Schema for open question
 */
export const OpenQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  context: z.string().optional(),
  suggestedActions: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high']),
});

/**
 * Schema for reproduction command
 */
export const ReproCommandSchema = z.object({
  description: z.string().min(1),
  command: z.string().min(1),
  workingDirectory: z.string().optional(),
  env: z.record(z.string()).optional(),
});

/**
 * Schema for verification summary
 */
export const VerificationSummarySchema = z.object({
  totalClauses: z.number().int().nonnegative(),
  passedClauses: z.number().int().nonnegative(),
  partialClauses: z.number().int().nonnegative(),
  failedClauses: z.number().int().nonnegative(),
  passRate: z.number().min(0).max(100),
  totalDurationMs: z.number().nonnegative(),
});

/**
 * Schema for verification metadata
 */
export const VerificationMetadataSchema = z.object({
  contractName: z.string().min(1),
  contractFile: z.string().optional(),
  verifierVersion: z.string().min(1),
  gitCommit: z.string().optional(),
  gitBranch: z.string().optional(),
  buildId: z.string().optional(),
  custom: z.record(z.unknown()).optional(),
});

/**
 * Schema for complete evidence report
 */
export const EvidenceReportSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  verdict: VerdictSchema,
  summary: VerificationSummarySchema,
  metadata: VerificationMetadataSchema,
  clauses: z.array(ClauseResultSchema),
  assumptions: z.array(AssumptionSchema),
  openQuestions: z.array(OpenQuestionSchema),
  reproCommands: z.array(ReproCommandSchema),
});

/**
 * Validate an evidence report
 * @param data - Raw data to validate
 * @returns Validated evidence report
 * @throws ZodError if validation fails
 */
export function validateEvidenceReport(data: unknown) {
  return EvidenceReportSchema.parse(data);
}

/**
 * Safely validate an evidence report
 * @param data - Raw data to validate
 * @returns Result object with success flag and data or error
 */
export function safeValidateEvidenceReport(data: unknown) {
  return EvidenceReportSchema.safeParse(data);
}

/**
 * Validate partial evidence report (for streaming/incremental updates)
 * @param data - Partial data to validate
 * @returns Validated partial data
 */
export function validatePartialReport(data: unknown) {
  return EvidenceReportSchema.partial().parse(data);
}
