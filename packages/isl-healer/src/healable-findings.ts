/**
 * Top 10 Healable Findings
 * 
 * Defines the most common findings that `isl heal` can automatically fix.
 * Each finding maps to a rule ID and includes:
 * - Description of what it detects
 * - What the fix does
 * - Safety guarantees
 */

export interface HealableFinding {
  /** Rule ID that triggers this finding */
  ruleId: string;
  /** Human-readable name */
  name: string;
  /** What problem this detects */
  description: string;
  /** What the fix does */
  fixDescription: string;
  /** Safety guarantees (what the fix won't do) */
  safetyGuarantees: string[];
  /** Priority (higher = more critical) */
  priority: number;
  /** Whether this fix requires user review */
  requiresReview: boolean;
}

/**
 * Top 10 healable findings, ordered by priority
 */
export const TOP_10_HEALABLE_FINDINGS: HealableFinding[] = [
  {
    ruleId: 'starter/no-missing-env-vars',
    name: 'Missing Environment Variable',
    description: 'Code references an environment variable that is not declared in .env files or truthpack',
    fixDescription: 'Adds the missing environment variable to .env.example with a placeholder value and adds it to the Zod schema if one exists',
    safetyGuarantees: [
      'Never removes code that uses the env var',
      'Never changes existing env var values',
      'Only adds to .env.example (never modifies production .env)',
    ],
    priority: 10,
    requiresReview: false,
  },
  {
    ruleId: 'starter/no-ghost-routes',
    name: 'Ghost Route (Route Not Found)',
    description: 'Route handler file exists but route is not registered in the routing system',
    fixDescription: 'Adds route registration to the appropriate router file (app router, pages router, or express routes)',
    safetyGuarantees: [
      'Never removes existing route registrations',
      'Preserves existing route order',
      'Only adds missing registrations',
    ],
    priority: 9,
    requiresReview: true,
  },
  {
    ruleId: 'pii/console-in-production',
    name: 'Console.log in Production Code',
    description: 'console.log, console.info, or console.debug statements found in production code',
    fixDescription: 'Removes console.log statements and replaces with proper logger calls if logger is available',
    safetyGuarantees: [
      'Never removes error handling or important logging',
      'Preserves console.error (for actual errors)',
      'Only removes debug/info logging',
    ],
    priority: 8,
    requiresReview: false,
  },
  {
    ruleId: 'intent/rate-limit-required',
    name: 'Missing Rate Limiting',
    description: 'Route handler requires rate limiting but none is implemented',
    fixDescription: 'Adds rate limiting middleware/check at the start of the handler function',
    safetyGuarantees: [
      'Never removes existing rate limiting',
      'Uses framework-appropriate rate limiting library',
      'Adds intent anchor comment for verification',
    ],
    priority: 8,
    requiresReview: false,
  },
  {
    ruleId: 'intent/input-validation',
    name: 'Missing Input Validation',
    description: 'Route handler accepts input but does not validate it with a schema',
    fixDescription: 'Adds Zod schema validation for request body/query parameters',
    safetyGuarantees: [
      'Never removes existing validation',
      'Creates schema based on actual usage patterns',
      'Returns proper 400 errors on validation failure',
    ],
    priority: 7,
    requiresReview: false,
  },
  {
    ruleId: 'starter/type-mismatch',
    name: 'Type Mismatch',
    description: 'Type mismatch between ISL spec and implementation (e.g., string vs number)',
    fixDescription: 'Fixes type mismatches by updating implementation to match spec types',
    safetyGuarantees: [
      'Never changes the ISL spec',
      'Only updates implementation types',
      'Preserves runtime behavior where possible',
    ],
    priority: 7,
    requiresReview: true,
  },
  {
    ruleId: 'intent/audit-required',
    name: 'Missing Audit Logging',
    description: 'Route handler requires audit logging but no audit calls are present',
    fixDescription: 'Adds audit logging calls on success and error paths',
    safetyGuarantees: [
      'Never removes existing audit calls',
      'Logs appropriate action names from ISL spec',
      'Includes relevant context (user ID, action, result)',
    ],
    priority: 6,
    requiresReview: false,
  },
  {
    ruleId: 'auth/missing-auth-check',
    name: 'Missing Authentication Check',
    description: 'Sensitive route handler does not check for authentication',
    fixDescription: 'Adds authentication middleware/check at the start of the handler',
    safetyGuarantees: [
      'Never removes existing auth checks',
      'Uses framework-appropriate auth library',
      'Returns proper 401 errors when unauthenticated',
    ],
    priority: 9,
    requiresReview: true,
  },
  {
    ruleId: 'intent/no-pii-logging',
    name: 'PII in Logs',
    description: 'Logging statements may contain personally identifiable information (passwords, emails, tokens)',
    fixDescription: 'Removes or sanitizes PII from log statements, replacing with placeholders',
    safetyGuarantees: [
      'Never removes important error context',
      'Only sanitizes sensitive fields',
      'Preserves log structure and readability',
    ],
    priority: 8,
    requiresReview: false,
  },
  {
    ruleId: 'starter/missing-route-binding',
    name: 'Missing Route Binding',
    description: 'Route handler function exists but is not exported or bound to HTTP method',
    fixDescription: 'Adds proper export and HTTP method binding (GET, POST, etc.)',
    safetyGuarantees: [
      'Never removes existing exports',
      'Preserves function signatures',
      'Uses framework-appropriate export pattern',
    ],
    priority: 6,
    requiresReview: false,
  },
];

/**
 * Get healable finding by rule ID
 */
export function getHealableFinding(ruleId: string): HealableFinding | undefined {
  return TOP_10_HEALABLE_FINDINGS.find(f => f.ruleId === ruleId);
}

/**
 * Check if a rule ID is healable
 */
export function isHealable(ruleId: string): boolean {
  return TOP_10_HEALABLE_FINDINGS.some(f => f.ruleId === ruleId);
}

/**
 * Get all healable rule IDs
 */
export function getHealableRuleIds(): string[] {
  return TOP_10_HEALABLE_FINDINGS.map(f => f.ruleId);
}
