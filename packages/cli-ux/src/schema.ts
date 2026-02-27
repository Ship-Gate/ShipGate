/**
 * JSON Schema Validation
 *
 * Zod schemas for validating JSON output structure.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Base Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const ClauseStatusSchema = z.enum(['passed', 'failed', 'skipped']);

export const ImpactLevelSchema = z.enum(['critical', 'high', 'medium', 'low']);

export const ClauseCategorySchema = z.enum([
  'postcondition',
  'precondition',
  'invariant',
  'scenario',
  'temporal',
  'chaos',
]);

export const RecommendationSchema = z.enum([
  'production_ready',
  'staging_recommended',
  'shadow_mode',
  'not_ready',
  'critical_issues',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Clause Result Schema
// ─────────────────────────────────────────────────────────────────────────────

export const ClauseResultSchema = z.object({
  name: z.string().min(1),
  status: ClauseStatusSchema,
  category: ClauseCategorySchema,
  impact: ImpactLevelSchema.optional(),
  duration: z.number().min(0),
  error: z.string().optional(),
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
  suggestedFix: z.string().optional(),
  expression: z.string().optional(),
  actual: z.unknown().optional(),
  expected: z.unknown().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Category Score Schema
// ─────────────────────────────────────────────────────────────────────────────

export const CategoryScoreSchema = z.object({
  score: z.number().min(0).max(100),
  passed: z.number().int().min(0),
  failed: z.number().int().min(0),
  total: z.number().int().min(0),
  weight: z.number().min(0).max(100).optional(),
});

export const CategoryBreakdownSchema = z.object({
  postconditions: CategoryScoreSchema,
  invariants: CategoryScoreSchema,
  scenarios: CategoryScoreSchema,
  temporal: CategoryScoreSchema,
  preconditions: CategoryScoreSchema.optional(),
  chaos: CategoryScoreSchema.optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Verification Result Schema
// ─────────────────────────────────────────────────────────────────────────────

export const VerificationResultSchema = z.object({
  success: z.boolean(),
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  recommendation: RecommendationSchema,
  specFile: z.string(),
  implFile: z.string(),
  clauses: z.array(ClauseResultSchema),
  breakdown: CategoryBreakdownSchema,
  duration: z.number().min(0),
  timestamp: z.string().datetime(),
  islVersion: z.string().optional(),
  warnings: z.array(z.string()).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// JSON Output Schema
// ─────────────────────────────────────────────────────────────────────────────

export const JsonOutputMetaSchema = z.object({
  cliVersion: z.string(),
  nodeVersion: z.string(),
  platform: z.string(),
  timestamp: z.string().datetime(),
});

export const JsonOutputSchema = z.object({
  schemaVersion: z.literal('1.0'),
  decision: z.enum(['SHIP', 'NO_SHIP']),
  result: VerificationResultSchema,
  meta: JsonOutputMetaSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: z.ZodError;
}

/**
 * Validate JSON output against schema
 */
export function validateJsonOutput(data: unknown): ValidationResult<z.infer<typeof JsonOutputSchema>> {
  const result = JsonOutputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Validate verification result against schema
 */
export function validateVerificationResult(
  data: unknown
): ValidationResult<z.infer<typeof VerificationResultSchema>> {
  const result = VerificationResultSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Get human-readable validation errors
 */
export function formatValidationErrors(errors: z.ZodError): string[] {
  return errors.errors.map((err) => {
    const path = err.path.join('.');
    return `${path}: ${err.message}`;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Exports
// ─────────────────────────────────────────────────────────────────────────────

export type ClauseResultSchemaType = z.infer<typeof ClauseResultSchema>;
export type CategoryScoreSchemaType = z.infer<typeof CategoryScoreSchema>;
export type CategoryBreakdownSchemaType = z.infer<typeof CategoryBreakdownSchema>;
export type VerificationResultSchemaType = z.infer<typeof VerificationResultSchema>;
export type JsonOutputSchemaType = z.infer<typeof JsonOutputSchema>;
