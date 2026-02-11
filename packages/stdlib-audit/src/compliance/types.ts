// ============================================================================
// ISL Standard Library - Compliance Types
// @stdlib/audit/compliance/types
// ============================================================================

import type { AuditEntry, EventCategory } from '../types.js';

// ============================================================================
// RULE INTERFACE
// ============================================================================

export interface ComplianceRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly severity: RuleSeverity;
  readonly standard?: string;
  evaluate(entries: AuditEntry[]): RuleResult;
}

export type RuleSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface RuleResult {
  ruleId: string;
  passed: boolean;
  message: string;
  details?: string;
  affectedEntries?: string[];
}

// ============================================================================
// REPORT TYPES
// ============================================================================

export interface ComplianceReport {
  generatedAt: Date;
  standard?: string;
  period: { from: Date; to: Date };
  summary: ReportSummary;
  results: RuleResult[];
  entries_evaluated: number;
}

export interface ReportSummary {
  total_rules: number;
  passed: number;
  failed: number;
  compliant: boolean;
  by_severity: Record<RuleSeverity, { passed: number; failed: number }>;
}
