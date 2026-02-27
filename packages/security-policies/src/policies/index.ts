// ============================================================================
// Security Policies - Policy Pack Index
// ============================================================================

export { piiProtectionPolicies, noPIILogsRule, noPIIExposureRule } from './no-pii-logs.js';
export { 
  secretsManagementPolicies,
  secretsAnnotationRule,
  secretsRedactionRule,
  secretsNotInOutputRule,
} from './secrets-redaction.js';
export {
  webhookSecurityPolicies,
  webhookSignatureRequiredRule,
  webhookIdempotencyRule,
  webhookReplayProtectionRule,
} from './webhook-signature.js';
export {
  rateLimitingPolicies,
  authRateLimitRule,
  authRateLimitStrictnessRule,
  sensitiveRateLimitRule,
  anonymousRateLimitRule,
} from './auth-rate-limit.js';

import { piiProtectionPolicies } from './no-pii-logs.js';
import { secretsManagementPolicies } from './secrets-redaction.js';
import { webhookSecurityPolicies } from './webhook-signature.js';
import { rateLimitingPolicies } from './auth-rate-limit.js';
import type { PolicyRule } from '../types.js';

/**
 * All security policy rules
 */
export const allPolicyRules: PolicyRule[] = [
  ...piiProtectionPolicies,
  ...secretsManagementPolicies,
  ...webhookSecurityPolicies,
  ...rateLimitingPolicies,
];

/**
 * Get policies by category
 */
export function getPoliciesByCategory(category: string): PolicyRule[] {
  return allPolicyRules.filter(rule => rule.category === category);
}

/**
 * Get policy by ID
 */
export function getPolicyById(id: string): PolicyRule | undefined {
  return allPolicyRules.find(rule => rule.id === id);
}
