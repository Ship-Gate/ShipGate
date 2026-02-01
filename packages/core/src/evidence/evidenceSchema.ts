/**
 * Zod Schema for Evidence Report Validation
 *
 * Provides runtime validation for evidence reports generated during
 * ISL specification verification.
 */

import { z } from 'zod';

/**
 * Schema for clause evaluation states
 */
export const ClauseStateSchema = z.enum(['PASS', 'PARTIAL', 'FAIL']);

/**
 * Schema for artifact types
 */
export const ArtifactTypeSchema = z.enum(['binding', 'test', 'trace', 'log', 'snapshot']);

/**
 * Schema for evidence artifacts
 */
export const EvidenceArtifactSchema = z.object({
  id: z.string().min(1, 'Artifact ID is required'),
  type: ArtifactTypeSchema,
  name: z.string().min(1, 'Artifact name is required'),
  location: z.string().optional(),
  content: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
  createdAt: z.string().datetime({ message: 'Invalid ISO 8601 datetime' }),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Schema for assumption categories
 */
export const AssumptionCategorySchema = z.enum([
  'input',
  'environment',
  'dependency',
  'timing',
  'other',
]);

/**
 * Schema for impact levels
 */
export const ImpactLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

/**
 * Schema for assumptions
 */
export const AssumptionSchema = z.object({
  id: z.string().min(1, 'Assumption ID is required'),
  description: z.string().min(1, 'Assumption description is required'),
  category: AssumptionCategorySchema,
  impact: ImpactLevelSchema,
  relatedClauses: z.array(z.string()).optional(),
});

/**
 * Schema for priority levels
 */
export const PriorityLevelSchema = z.enum(['low', 'medium', 'high']);

/**
 * Schema for open questions
 */
export const OpenQuestionSchema = z.object({
  id: z.string().min(1, 'Question ID is required'),
  question: z.string().min(1, 'Question text is required'),
  priority: PriorityLevelSchema,
  context: z.string().optional(),
  relatedClauses: z.array(z.string()).optional(),
  suggestedActions: z.array(z.string()).optional(),
});

/**
 * Schema for confidence levels
 */
export const ConfidenceLevelSchema = z.enum(['low', 'medium', 'high']);

/**
 * Schema for ship recommendations
 */
export const RecommendationSchema = z.enum(['ship', 'review', 'block']);

/**
 * Schema for score summary
 */
export const ScoreSummarySchema = z
  .object({
    overallScore: z.number().min(0).max(100),
    passCount: z.number().int().nonnegative(),
    partialCount: z.number().int().nonnegative(),
    failCount: z.number().int().nonnegative(),
    totalClauses: z.number().int().nonnegative(),
    passRate: z.number().min(0).max(100),
    confidence: ConfidenceLevelSchema,
    recommendation: RecommendationSchema,
  })
  .refine(
    (data) => data.passCount + data.partialCount + data.failCount === data.totalClauses,
    {
      message: 'Sum of passCount, partialCount, and failCount must equal totalClauses',
      path: ['totalClauses'],
    }
  );

/**
 * Schema for verification modes
 */
export const VerificationModeSchema = z.enum(['full', 'incremental', 'quick']);

/**
 * Schema for verification metadata
 */
export const VerificationMetadataSchema = z
  .object({
    startedAt: z.string().datetime({ message: 'Invalid ISO 8601 datetime for startedAt' }),
    completedAt: z.string().datetime({ message: 'Invalid ISO 8601 datetime for completedAt' }),
    durationMs: z.number().int().nonnegative(),
    agentVersion: z.string().min(1, 'Agent version is required'),
    environment: z.string().optional(),
    mode: VerificationModeSchema.optional(),
  })
  .refine(
    (data) => new Date(data.completedAt) >= new Date(data.startedAt),
    {
      message: 'completedAt must be after or equal to startedAt',
      path: ['completedAt'],
    }
  );

/**
 * Schema for clause types
 */
export const ClauseTypeSchema = z.enum([
  'precondition',
  'postcondition',
  'invariant',
  'effect',
  'constraint',
]);

/**
 * Schema for evidence clause results (extended from base ClauseResult)
 */
export const EvidenceClauseResultSchema = z.object({
  clauseId: z.string().min(1, 'Clause ID is required'),
  state: ClauseStateSchema,
  message: z.string().optional(),
  clauseType: ClauseTypeSchema.optional(),
  trace: z.string().optional(),
  actualValue: z.unknown().optional(),
  expectedValue: z.unknown().optional(),
  evaluationTimeMs: z.number().int().nonnegative().optional(),
  artifactIds: z.array(z.string()).optional(),
});

/**
 * Schema for the complete evidence report
 */
export const EvidenceReportSchema = z
  .object({
    version: z.literal('1.0'),
    reportId: z.string().min(1, 'Report ID is required'),
    specFingerprint: z.string().min(1, 'Spec fingerprint is required'),
    specName: z.string().optional(),
    specPath: z.string().optional(),
    clauseResults: z.array(EvidenceClauseResultSchema),
    scoreSummary: ScoreSummarySchema,
    assumptions: z.array(AssumptionSchema),
    openQuestions: z.array(OpenQuestionSchema),
    artifacts: z.array(EvidenceArtifactSchema),
    metadata: VerificationMetadataSchema,
    notes: z.string().optional(),
  })
  .refine(
    (data) => data.clauseResults.length === data.scoreSummary.totalClauses,
    {
      message: 'Number of clauseResults must match scoreSummary.totalClauses',
      path: ['clauseResults'],
    }
  );

/**
 * Type inference from the schema
 */
export type EvidenceReportFromSchema = z.infer<typeof EvidenceReportSchema>;
export type EvidenceClauseResultFromSchema = z.infer<typeof EvidenceClauseResultSchema>;
export type ScoreSummaryFromSchema = z.infer<typeof ScoreSummarySchema>;
export type AssumptionFromSchema = z.infer<typeof AssumptionSchema>;
export type OpenQuestionFromSchema = z.infer<typeof OpenQuestionSchema>;
export type EvidenceArtifactFromSchema = z.infer<typeof EvidenceArtifactSchema>;
export type VerificationMetadataFromSchema = z.infer<typeof VerificationMetadataSchema>;
