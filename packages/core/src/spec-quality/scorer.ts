/**
 * ISL Spec Quality Scorer
 *
 * Combines all dimension checkers into a single quality report.
 * This is the main entry point for scoring an ISL spec.
 */

import type { Domain } from '@isl-lang/parser';
import type {
  SpecQualityReport,
  SpecQualityOptions,
  DimensionChecker,
  DimensionScore,
  QualitySuggestion,
  QualityDimension,
} from './types.js';
import { DEFAULT_WEIGHTS } from './types.js';
import {
  completenessChecker,
  specificityChecker,
  securityChecker,
  testabilityChecker,
  consistencyChecker,
} from './checkers/index.js';

// ============================================================================
// All Checkers (in evaluation order)
// ============================================================================

const ALL_CHECKERS: DimensionChecker[] = [
  completenessChecker,
  specificityChecker,
  securityChecker,
  testabilityChecker,
  consistencyChecker,
];

// ============================================================================
// Main Scorer
// ============================================================================

/**
 * Score an ISL domain AST across all quality dimensions.
 *
 * @param domain  - Parsed ISL domain
 * @param file    - Source file path (for report)
 * @param options - Scoring options
 * @returns Full quality report
 *
 * @example
 * ```typescript
 * import { parse } from '@isl-lang/parser';
 * import { scoreSpec } from '@isl-lang/core/spec-quality';
 *
 * const { domain } = parse(source, filePath);
 * if (domain) {
 *   const report = scoreSpec(domain, filePath);
 *   console.log(`Overall: ${report.overallScore}/100`);
 * }
 * ```
 */
export function scoreSpec(
  domain: Domain,
  file: string,
  options: SpecQualityOptions = {},
): SpecQualityReport {
  const startTime = Date.now();

  const skipDimensions = new Set(options.skipDimensions ?? []);
  const weights = { ...DEFAULT_WEIGHTS, ...options.weights };

  // Normalize weights for active dimensions
  const activeDimensions = ALL_CHECKERS.filter(c => !skipDimensions.has(c.dimension));
  const totalWeight = activeDimensions.reduce((sum, c) => sum + (weights[c.dimension] ?? 0), 0);

  const dimensions: Record<string, DimensionScore> = {};
  const allSuggestions: QualitySuggestion[] = [];
  let weightedSum = 0;

  for (const checker of ALL_CHECKERS) {
    if (skipDimensions.has(checker.dimension)) {
      // Skipped dimensions get a neutral score
      dimensions[checker.dimension] = { score: -1, findings: ['Skipped'] };
      continue;
    }

    const result = checker.check(domain, file);
    dimensions[checker.dimension] = result.score;
    allSuggestions.push(...result.suggestions);

    const normalizedWeight = totalWeight > 0 ? (weights[checker.dimension] ?? 0) / totalWeight : 0;
    weightedSum += result.score.score * normalizedWeight;
  }

  // Sort suggestions: critical first, then warning, then info
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  allSuggestions.sort(
    (a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3),
  );

  const overallScore = Math.round(weightedSum);
  const durationMs = Date.now() - startTime;

  return {
    file,
    overallScore,
    dimensions: {
      completeness: dimensions['completeness'] ?? { score: 0, findings: [] },
      specificity: dimensions['specificity'] ?? { score: 0, findings: [] },
      security: dimensions['security'] ?? { score: 0, findings: [] },
      testability: dimensions['testability'] ?? { score: 0, findings: [] },
      consistency: dimensions['consistency'] ?? { score: 0, findings: [] },
    },
    suggestions: allSuggestions,
    durationMs,
  };
}

/**
 * Format a quality report as a colorized CLI string.
 */
export function formatReport(report: SpecQualityReport): string {
  const lines: string[] = [];

  const fileName = report.file.split(/[\\/]/).pop() ?? report.file;
  lines.push(`ISL Spec Quality Report: ${fileName}`);
  lines.push('\u2500'.repeat(40));
  lines.push(`Overall Score: ${report.overallScore}/100`);
  lines.push('');

  const dimensionLabels: Record<QualityDimension, string> = {
    completeness: 'Completeness',
    specificity: 'Specificity',
    security: 'Security',
    testability: 'Testability',
    consistency: 'Consistency',
  };

  const dims: QualityDimension[] = ['completeness', 'specificity', 'security', 'testability', 'consistency'];

  for (const dim of dims) {
    const d = report.dimensions[dim];
    if (d.score < 0) {
      lines.push(`${padRight(dimensionLabels[dim] + ':', 15)} skipped`);
      continue;
    }

    const bar = renderBar(d.score);
    lines.push(`${padRight(dimensionLabels[dim] + ':', 15)} ${bar}  ${d.score}`);

    // Show findings
    for (const finding of d.findings) {
      lines.push(`  + ${finding}`);
    }

    // Show per-dimension suggestions
    const dimSuggestions = report.suggestions.filter(s => s.dimension === dim);
    for (const s of dimSuggestions) {
      const icon = s.severity === 'critical' ? '!!' : s.severity === 'warning' ? '!' : '~';
      lines.push(`  ${icon} ${s.message}`);
      if (s.example) {
        lines.push(`    -> ${s.example.split('\n')[0]}`);
      }
    }

    lines.push('');
  }

  // Summary suggestions
  if (report.suggestions.length > 0) {
    lines.push('Suggestions:');
    const seen = new Set<string>();
    for (const s of report.suggestions) {
      if (seen.has(s.message)) continue;
      seen.add(s.message);
      const icon = s.severity === 'critical' ? '[critical]' : s.severity === 'warning' ? '[warning]' : '[info]';
      lines.push(`  ${icon} ${s.message}`);
    }
    lines.push('');
  }

  lines.push(`Scored in ${report.durationMs}ms`);

  return lines.join('\n');
}

// ============================================================================
// Helpers
// ============================================================================

function renderBar(score: number): string {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

function padRight(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}
