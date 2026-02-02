/**
 * ISL Policy Packs - Auth Policy Pack
 * 
 * Rules for authentication and authorization security patterns.
 * 
 * @module @isl-lang/policy-packs/auth
 */

import type { PolicyPack, PolicyRule, RuleViolation, RuleContext } from '../types.js';
import {
  findClaimsByType,
  hasEvidence,
  matchesAnyPattern,
  containsKeyword,
  isProtectedPath,
  isPublicPath,
} from '../utils.js';

// ============================================================================
// Auth Bypass Patterns
// ============================================================================

const AUTH_BYPASS_PATTERNS = [
  /auth\s*[=:]\s*false/i,
  /skipAuth/i,
  /noAuth/i,
  /bypassAuth/i,
  /requireAuth\s*[=:]\s*false/i,
  /isPublic\s*[=:]\s*true/i,
  /disableAuth/i,
  /authDisabled/i,
  /\.skip\s*\(\s*['"]auth/i,
];

const AUTH_KEYWORDS = [
  'authenticate',
  'authorize',
  'requireAuth',
  'isAuthenticated',
  'checkPermission',
  'requireRole',
  'verifyToken',
  'validateSession',
  'authMiddleware',
  'authGuard',
];

// ============================================================================
// Rules
// ============================================================================

/**
 * Auth Bypass Detection Rule
 */
const authBypassRule: PolicyRule = {
  id: 'auth/bypass-detected',
  name: 'Auth Bypass Detected',
  description: 'Detects code patterns that bypass or disable authentication',
  severity: 'error',
  category: 'auth',
  tags: ['security', 'authentication', 'bypass'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    const match = matchesAnyPattern(ctx.content, AUTH_BYPASS_PATTERNS);
    if (match) {
      return {
        ruleId: 'auth/bypass-detected',
        ruleName: 'Auth Bypass Detected',
        severity: 'error',
        tier: 'hard_block',
        message: `AUTH BYPASS: Suspicious pattern "${match[0]}" may disable authentication`,
        location: { file: ctx.filePath },
        suggestion: 'Remove auth bypass patterns. If this is intentional, add to allowlist.',
      };
    }
    return null;
  },
};

/**
 * Auth Drift Detection Rule
 */
const authDriftRule: PolicyRule = {
  id: 'auth/drift-detected',
  name: 'Auth Drift Detected',
  description: 'Detects changes that may weaken authentication controls',
  severity: 'warning',
  category: 'auth',
  tags: ['security', 'authentication', 'drift'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    // Check if auth-related imports are missing
    const importClaims = findClaimsByType(ctx.claims, 'import');
    const authImports = importClaims.filter(c => 
      containsKeyword(c.value, AUTH_KEYWORDS)
    );

    for (const authImport of authImports) {
      if (!hasEvidence(authImport, ctx.evidence)) {
        return {
          ruleId: 'auth/drift-detected',
          ruleName: 'Auth Drift Detected',
          severity: 'warning',
          tier: 'soft_block',
          message: `AUTH DRIFT: Auth-related import not found: ${authImport.value}`,
          claim: authImport,
          location: { file: ctx.filePath },
          suggestion: 'Ensure authentication middleware is properly imported',
        };
      }
    }

    return null;
  },
};

/**
 * Unprotected Route Rule
 */
const unprotectedRouteRule: PolicyRule = {
  id: 'auth/unprotected-route',
  name: 'Unprotected Route',
  description: 'Detects routes that should be protected but lack authentication',
  severity: 'error',
  category: 'auth',
  tags: ['security', 'authentication', 'routes'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    const routeClaims = findClaimsByType(ctx.claims, 'api_endpoint');

    for (const routeClaim of routeClaims) {
      // Check if this route should be protected
      if (isProtectedPath(routeClaim.value, ctx.truthpack)) {
        // Check if it's not explicitly public
        if (!isPublicPath(routeClaim.value, ctx.truthpack)) {
          // Look for auth bypass patterns in context
          const context = routeClaim.context || ctx.content;
          const hasAuthBypass = matchesAnyPattern(context, AUTH_BYPASS_PATTERNS);
          
          if (hasAuthBypass) {
            return {
              ruleId: 'auth/unprotected-route',
              ruleName: 'Unprotected Route',
              severity: 'error',
              tier: 'hard_block',
              message: `UNPROTECTED ROUTE: "${routeClaim.value}" should require authentication`,
              claim: routeClaim,
              location: { file: ctx.filePath },
              suggestion: 'Add authentication middleware to this route',
            };
          }
        }
      }
    }

    return null;
  },
};

/**
 * Missing Role Check Rule
 */
const missingRoleCheckRule: PolicyRule = {
  id: 'auth/missing-role-check',
  name: 'Missing Role Check',
  description: 'Detects protected routes without proper role verification',
  severity: 'warning',
  category: 'auth',
  tags: ['security', 'authorization', 'rbac'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    const routeClaims = findClaimsByType(ctx.claims, 'api_endpoint');

    for (const routeClaim of routeClaims) {
      // Get route definition from truthpack
      const routeDef = ctx.truthpack.routes?.find(r => 
        r.path === routeClaim.value
      );

      if (routeDef?.auth?.roles && routeDef.auth.roles.length > 0) {
        // This route requires specific roles - check if role check exists
        const context = routeClaim.context || ctx.content;
        const hasRoleCheck = /requireRole|checkRole|hasRole|role\s*[=:]/i.test(context);
        
        if (!hasRoleCheck) {
          return {
            ruleId: 'auth/missing-role-check',
            ruleName: 'Missing Role Check',
            severity: 'warning',
            tier: 'soft_block',
            message: `MISSING ROLE CHECK: "${routeClaim.value}" requires roles ${routeDef.auth.roles.join(', ')}`,
            claim: routeClaim,
            location: { file: ctx.filePath },
            suggestion: `Add role check for: ${routeDef.auth.roles.join(', ')}`,
          };
        }
      }
    }

    return null;
  },
};

/**
 * Hardcoded Credentials Rule
 */
const hardcodedCredentialsRule: PolicyRule = {
  id: 'auth/hardcoded-credentials',
  name: 'Hardcoded Credentials',
  description: 'Detects hardcoded passwords, API keys, or secrets',
  severity: 'error',
  category: 'auth',
  tags: ['security', 'secrets', 'credentials'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    const patterns = [
      /password\s*[=:]\s*['"][^'"]{4,}['"]/i,
      /api_?key\s*[=:]\s*['"][^'"]{8,}['"]/i,
      /secret\s*[=:]\s*['"][^'"]{8,}['"]/i,
      /token\s*[=:]\s*['"][^'"]{16,}['"]/i,
      /private_?key\s*[=:]\s*['"][^'"]+['"]/i,
    ];

    const match = matchesAnyPattern(ctx.content, patterns);
    if (match) {
      return {
        ruleId: 'auth/hardcoded-credentials',
        ruleName: 'Hardcoded Credentials',
        severity: 'error',
        tier: 'hard_block',
        message: 'HARDCODED CREDENTIALS: Potential secret detected in code',
        location: { file: ctx.filePath },
        suggestion: 'Use environment variables for sensitive values',
      };
    }

    return null;
  },
};

// ============================================================================
// Policy Pack Export
// ============================================================================

export const authPolicyPack: PolicyPack = {
  id: 'auth',
  name: 'Authentication & Authorization',
  description: 'Rules for secure authentication and authorization patterns',
  version: '0.1.0',
  rules: [
    authBypassRule,
    authDriftRule,
    unprotectedRouteRule,
    missingRoleCheckRule,
    hardcodedCredentialsRule,
  ],
  defaultConfig: {
    enabled: true,
  },
};

export default authPolicyPack;
