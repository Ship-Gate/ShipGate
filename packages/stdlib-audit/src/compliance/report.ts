// ============================================================================
// ISL Standard Library - Compliance Report Generator
// @stdlib/audit/compliance/report
// ============================================================================

import type { AuditEntry, Result, ComplianceError } from '../types.js';
import { Ok, Err } from '../types.js';
import { reportGenerationFailed } from '../errors.js';
import type { ComplianceRule, ComplianceReport, ReportSummary, RuleSeverity, RuleResult } from './types.js';
import { ComplianceChecker } from './checker.js';

// ============================================================================
// REPORT GENERATOR
// ============================================================================

export function generateReport(
  entries: AuditEntry[],
  rules: ComplianceRule[],
  options?: ReportOptions,
): Result<ComplianceReport, ComplianceError> {
  if (entries.length === 0) {
    return Err(reportGenerationFailed('No entries to evaluate'));
  }

  const checker = new ComplianceChecker();
  checker.addRules(rules);

  const evalResult = checker.evaluate(entries);
  if (!evalResult.ok) return evalResult as Result<ComplianceReport, ComplianceError>;

  const results = evalResult.value;
  const summary = buildSummary(results, rules);

  const timestamps = entries.map((e) => e.timestamp.getTime());
  const from = new Date(Math.min(...timestamps));
  const to = new Date(Math.max(...timestamps));

  const report: ComplianceReport = {
    generatedAt: new Date(),
    standard: options?.standard,
    period: { from, to },
    summary,
    results,
    entries_evaluated: entries.length,
  };

  return Ok(report);
}

// ============================================================================
// SUMMARY BUILDER
// ============================================================================

function buildSummary(results: RuleResult[], rules: ComplianceRule[]): ReportSummary {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  const severities: RuleSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
  const by_severity = {} as Record<RuleSeverity, { passed: number; failed: number }>;

  for (const sev of severities) {
    const rulesForSev = rules.filter((r) => r.severity === sev);
    const ruleIds = new Set(rulesForSev.map((r) => r.id));
    const sevResults = results.filter((r) => ruleIds.has(r.ruleId));
    by_severity[sev] = {
      passed: sevResults.filter((r) => r.passed).length,
      failed: sevResults.filter((r) => !r.passed).length,
    };
  }

  return {
    total_rules: results.length,
    passed,
    failed,
    compliant: failed === 0,
    by_severity,
  };
}

// ============================================================================
// OPTIONS
// ============================================================================

export interface ReportOptions {
  standard?: string;
}
