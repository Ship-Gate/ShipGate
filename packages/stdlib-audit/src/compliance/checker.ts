// ============================================================================
// ISL Standard Library - Compliance Checker
// @stdlib/audit/compliance/checker
// ============================================================================

import type { AuditEntry, Result, ComplianceError } from '../types.js';
import { Ok, Err } from '../types.js';
import { ruleEvaluationFailed } from '../errors.js';
import type { ComplianceRule, RuleResult } from './types.js';

// ============================================================================
// COMPLIANCE CHECKER
// ============================================================================

export class ComplianceChecker {
  private rules: ComplianceRule[] = [];

  addRule(rule: ComplianceRule): this {
    this.rules.push(rule);
    return this;
  }

  addRules(rules: ComplianceRule[]): this {
    this.rules.push(...rules);
    return this;
  }

  removeRule(ruleId: string): this {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
    return this;
  }

  getRules(): readonly ComplianceRule[] {
    return this.rules;
  }

  evaluate(entries: AuditEntry[]): Result<RuleResult[], ComplianceError> {
    const results: RuleResult[] = [];

    for (const rule of this.rules) {
      try {
        const result = rule.evaluate(entries);
        results.push(result);
      } catch (err) {
        return Err(ruleEvaluationFailed(rule.id, (err as Error).message));
      }
    }

    return Ok(results);
  }

  isCompliant(entries: AuditEntry[]): Result<boolean, ComplianceError> {
    const results = this.evaluate(entries);
    if (!results.ok) return results;
    return Ok(results.value.every((r) => r.passed));
  }
}
