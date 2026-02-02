// ============================================================================
// Lint Rules - Index
// ============================================================================

export { authLintRules, authConstraintsRule, sessionSecurityRule } from './auth-constraints.js';
export { 
  paymentLintRules, 
  paymentConstraintsRule, 
  paymentFraudCheckRule,
  pciComplianceRule,
} from './payments-constraints.js';
export { 
  webhookLintRules, 
  webhookConstraintsRule, 
  webhookErrorHandlingRule,
  webhookResponseTimeRule,
} from './webhooks-constraints.js';

import { authLintRules } from './auth-constraints.js';
import { paymentLintRules } from './payments-constraints.js';
import { webhookLintRules } from './webhooks-constraints.js';
import type { LintRule } from '../../types.js';

/**
 * All lint rules
 */
export const allLintRules: LintRule[] = [
  ...authLintRules,
  ...paymentLintRules,
  ...webhookLintRules,
];

/**
 * Get lint rules by category
 */
export function getLintRulesByCategory(category: string): LintRule[] {
  return allLintRules.filter(rule => rule.category === category);
}

/**
 * Get lint rule by ID
 */
export function getLintRuleById(id: string): LintRule | undefined {
  return allLintRules.find(rule => rule.id === id);
}
