/**
 * Evidence Report Validation Functions
 *
 * Provides validation utilities for evidence reports.
 */

import { ZodError } from 'zod';
import { EvidenceReportSchema } from './evidenceSchema.js';
import type { EvidenceReport, ValidationResult, ValidationError } from './evidenceTypes.js';

/**
 * Validates an evidence report against the schema
 *
 * @param report - The report to validate (unknown type for runtime safety)
 * @returns ValidationResult with valid flag and any errors
 *
 * @example
 * ```typescript
 * const result = validateEvidenceReport(myReport);
 * if (result.valid) {
 *   console.log('Report is valid!');
 * } else {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */
export function validateEvidenceReport(report: unknown): ValidationResult {
  try {
    EvidenceReportSchema.parse(report);
    return {
      valid: true,
      errors: [],
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: ValidationError[] = error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));
      return {
        valid: false,
        errors,
      };
    }
    // Unexpected error - wrap it
    return {
      valid: false,
      errors: [
        {
          path: '',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          code: 'unknown_error',
        },
      ],
    };
  }
}

/**
 * Type guard to check if a value is a valid EvidenceReport
 *
 * @param report - The value to check
 * @returns True if the value is a valid EvidenceReport
 */
export function isValidEvidenceReport(report: unknown): report is EvidenceReport {
  return validateEvidenceReport(report).valid;
}

/**
 * Validates an evidence report and returns the typed report or throws
 *
 * @param report - The report to validate
 * @returns The validated report with proper typing
 * @throws Error if validation fails
 */
export function parseEvidenceReport(report: unknown): EvidenceReport {
  const result = EvidenceReportSchema.parse(report);
  return result as EvidenceReport;
}

/**
 * Safely validates an evidence report and returns a result object
 *
 * @param report - The report to validate
 * @returns Object with success flag, data (if valid), or error (if invalid)
 */
export function safeParseEvidenceReport(report: unknown): {
  success: true;
  data: EvidenceReport;
} | {
  success: false;
  error: ValidationResult;
} {
  const result = EvidenceReportSchema.safeParse(report);
  if (result.success) {
    return {
      success: true,
      data: result.data as EvidenceReport,
    };
  }
  return {
    success: false,
    error: {
      valid: false,
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })),
    },
  };
}

/**
 * Creates a minimal valid evidence report for testing or initialization
 *
 * @param overrides - Partial report to merge with defaults
 * @returns A valid evidence report
 */
export function createMinimalEvidenceReport(
  overrides: Partial<EvidenceReport> = {}
): EvidenceReport {
  const now = new Date().toISOString();
  const defaults: EvidenceReport = {
    version: '1.0',
    reportId: `report-${Date.now()}`,
    specFingerprint: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    clauseResults: [],
    scoreSummary: {
      overallScore: 100,
      passCount: 0,
      partialCount: 0,
      failCount: 0,
      totalClauses: 0,
      passRate: 100,
      confidence: 'high',
      recommendation: 'ship',
    },
    assumptions: [],
    openQuestions: [],
    artifacts: [],
    metadata: {
      startedAt: now,
      completedAt: now,
      durationMs: 0,
      agentVersion: '1.0.0',
    },
  };

  // Deep merge for nested objects
  const merged: EvidenceReport = {
    ...defaults,
    ...overrides,
    scoreSummary: {
      ...defaults.scoreSummary,
      ...overrides.scoreSummary,
    },
    metadata: {
      ...defaults.metadata,
      ...overrides.metadata,
    },
  };

  return merged;
}
