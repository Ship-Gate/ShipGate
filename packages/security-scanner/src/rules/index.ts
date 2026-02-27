// ============================================================================
// Security Rules Index
// ============================================================================

export * from './auth';
export * from './injection';
export * from './crypto';
export * from './data';
export * from './config';

import { SecurityRule } from '../severity';
import { authRules } from './auth';
import { injectionRules } from './injection';
import { cryptoRules } from './crypto';
import { dataRules } from './data';
import { configRules } from './config';

// ============================================================================
// All Built-in Rules
// ============================================================================

export const ALL_RULES: SecurityRule[] = [
  ...authRules,
  ...injectionRules,
  ...cryptoRules,
  ...dataRules,
  ...configRules,
];

// ============================================================================
// Rule Registry
// ============================================================================

export const RULE_REGISTRY: Map<string, SecurityRule> = new Map(
  ALL_RULES.map((rule) => [rule.id, rule])
);

export function getRule(id: string): SecurityRule | undefined {
  return RULE_REGISTRY.get(id);
}

export function getRulesByCategory(category: string): SecurityRule[] {
  return ALL_RULES.filter((rule) => rule.category === category);
}

export function getRulesBySeverity(severity: string): SecurityRule[] {
  return ALL_RULES.filter((rule) => rule.severity === severity);
}

// ============================================================================
// Rule Metadata
// ============================================================================

export interface RuleMetadata {
  id: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  cwe?: string;
  owasp?: string;
}

export function getRuleMetadata(): RuleMetadata[] {
  return ALL_RULES.map((rule) => ({
    id: rule.id,
    title: rule.title,
    description: rule.description,
    severity: rule.severity,
    category: rule.category,
    cwe: rule.cwe,
    owasp: rule.owasp,
  }));
}

// ============================================================================
// Rule Summary
// ============================================================================

export interface RuleSummary {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
}

export function getRuleSummary(): RuleSummary {
  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  for (const rule of ALL_RULES) {
    byCategory[rule.category] = (byCategory[rule.category] || 0) + 1;
    bySeverity[rule.severity] = (bySeverity[rule.severity] || 0) + 1;
  }

  return {
    total: ALL_RULES.length,
    byCategory,
    bySeverity,
  };
}
