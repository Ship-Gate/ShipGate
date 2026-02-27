/**
 * ISL Quality Linting — wraps @isl-lang/core spec-quality scorer.
 *
 * Parses the ISL source and scores it across five quality dimensions:
 * completeness, specificity, security, testability, consistency.
 *
 * @internal — consumers import from the root `@shipgate/sdk` entry.
 */

import { parse } from '@isl-lang/parser';
import { scoreSpec } from '@isl-lang/core/spec-quality';
import type { QualityReport } from './types.js';

// ============================================================================
// Helpers
// ============================================================================

/** Build a zero-score report for parse failures. */
function failedReport(errors: Array<{ message: string }>): QualityReport {
  const zero = Object.freeze({ score: 0, findings: Object.freeze(['Parse failed']) });

  return Object.freeze({
    score: 0,
    dimensions: Object.freeze({
      completeness: zero,
      specificity: zero,
      security: zero,
      testability: zero,
      consistency: zero,
    }),
    suggestions: Object.freeze(
      errors.map((e) =>
        Object.freeze({
          dimension: 'completeness' as const,
          severity: 'critical' as const,
          message: e.message,
        }),
      ),
    ),
  });
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Lint an ISL source string and return a quality report.
 *
 * Parses the ISL, then scores the resulting domain across five dimensions.
 * If the source fails to parse, returns a zero-score report with parse errors
 * as critical suggestions.
 *
 * @param source - ISL source code string
 * @returns Quality report with dimension scores and suggestions
 *
 * @example
 * ```typescript
 * const report = lintISL(`
 *   domain Payments version "1.0" {
 *     behavior Charge {
 *       postconditions { success { result.charged == true } }
 *     }
 *   }
 * `);
 *
 * console.log(report.score);                    // 0–100
 * console.log(report.dimensions.security.score); // 0–100
 * console.log(report.suggestions);               // actionable items
 * ```
 */
export function lintISL(source: string): QualityReport {
  const parsed = parse(source);

  if (!parsed.success || !parsed.domain) {
    return failedReport(parsed.errors.map((e) => ({ message: e.message })));
  }

  const report = scoreSpec(parsed.domain, '<inline>');

  return Object.freeze({
    score: report.overallScore,
    dimensions: Object.freeze({
      completeness: Object.freeze({
        score: report.dimensions.completeness.score,
        findings: Object.freeze([...report.dimensions.completeness.findings]),
      }),
      specificity: Object.freeze({
        score: report.dimensions.specificity.score,
        findings: Object.freeze([...report.dimensions.specificity.findings]),
      }),
      security: Object.freeze({
        score: report.dimensions.security.score,
        findings: Object.freeze([...report.dimensions.security.findings]),
      }),
      testability: Object.freeze({
        score: report.dimensions.testability.score,
        findings: Object.freeze([...report.dimensions.testability.findings]),
      }),
      consistency: Object.freeze({
        score: report.dimensions.consistency.score,
        findings: Object.freeze([...report.dimensions.consistency.findings]),
      }),
    }),
    suggestions: Object.freeze(
      report.suggestions.map((s) =>
        Object.freeze({
          dimension: s.dimension,
          severity: s.severity,
          message: s.message,
        }),
      ),
    ),
  });
}
