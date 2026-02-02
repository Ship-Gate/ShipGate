/**
 * ISL Policy Packs - Rate Limiting Policy Pack
 * 
 * Rules for rate limiting and DoS protection patterns.
 * 
 * @module @isl-lang/policy-packs/rate-limit
 */

import type { PolicyPack, PolicyRule, RuleViolation, RuleContext } from '../types.js';
import { matchesAnyPattern, containsKeyword, findClaimsByType } from '../utils.js';

// ============================================================================
// Rate Limiting Patterns
// ============================================================================

const RATE_LIMIT_KEYWORDS = [
  'rateLimit',
  'rateLimiter',
  'throttle',
  'limiter',
  'requestLimit',
  'apiLimit',
];

const EXPENSIVE_OPERATIONS = [
  'upload',
  'export',
  'import',
  'bulk',
  'batch',
  'download',
  'report',
  'generate',
];

// ============================================================================
// Rules
// ============================================================================

/**
 * Missing Rate Limit Rule
 */
const missingRateLimitRule: PolicyRule = {
  id: 'rate-limit/missing',
  name: 'Missing Rate Limit',
  description: 'Detects API endpoints without rate limiting',
  severity: 'warning',
  category: 'rate-limit',
  tags: ['security', 'dos', 'api'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    const routeClaims = findClaimsByType(ctx.claims, 'api_endpoint');
    
    if (routeClaims.length === 0) return null;

    // Check if rate limiting is present
    const hasRateLimit = containsKeyword(ctx.content, RATE_LIMIT_KEYWORDS);
    
    if (!hasRateLimit) {
      // Check truthpack for rate limit requirements
      for (const claim of routeClaims) {
        const routeDef = ctx.truthpack.routes?.find(r => r.path === claim.value);
        
        if (routeDef?.rateLimit) {
          return {
            ruleId: 'rate-limit/missing',
            ruleName: 'Missing Rate Limit',
            severity: 'warning',
            tier: 'soft_block',
            message: `MISSING RATE LIMIT: "${claim.value}" should have rate limiting`,
            claim,
            location: { file: ctx.filePath },
            suggestion: `Add rate limiting: ${routeDef.rateLimit.requests} requests per ${routeDef.rateLimit.windowMs}ms`,
          };
        }
      }
    }

    return null;
  },
};

/**
 * Expensive Operation Without Limit Rule
 */
const expensiveOperationRule: PolicyRule = {
  id: 'rate-limit/expensive-unprotected',
  name: 'Expensive Operation Unprotected',
  description: 'Detects expensive operations without rate limiting or queuing',
  severity: 'warning',
  category: 'rate-limit',
  tags: ['performance', 'dos', 'api'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    // Check for expensive operation keywords
    const expensiveOp = containsKeyword(ctx.content, EXPENSIVE_OPERATIONS);
    
    if (!expensiveOp) return null;

    // Check if protection exists
    const hasProtection = containsKeyword(ctx.content, [
      ...RATE_LIMIT_KEYWORDS,
      'queue',
      'job',
      'worker',
      'background',
      'async',
    ]);

    if (!hasProtection) {
      return {
        ruleId: 'rate-limit/expensive-unprotected',
        ruleName: 'Expensive Operation Unprotected',
        severity: 'warning',
        tier: 'soft_block',
        message: `EXPENSIVE UNPROTECTED: "${expensiveOp}" operation may need rate limiting or queueing`,
        location: { file: ctx.filePath },
        suggestion: 'Add rate limiting or move to background job queue',
      };
    }

    return null;
  },
};

/**
 * Weak Rate Limit Configuration Rule
 */
const weakRateLimitRule: PolicyRule = {
  id: 'rate-limit/weak-config',
  name: 'Weak Rate Limit Configuration',
  description: 'Detects rate limits that may be too permissive',
  severity: 'info',
  category: 'rate-limit',
  tags: ['security', 'configuration'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    // Look for rate limit configurations
    const configPatterns = [
      /windowMs\s*[=:]\s*(\d+)/,
      /max\s*[=:]\s*(\d+)/,
      /limit\s*[=:]\s*(\d+)/,
    ];

    for (const pattern of configPatterns) {
      const match = ctx.content.match(pattern);
      if (match) {
        const value = parseInt(match[1], 10);
        
        // Check for suspiciously high limits
        if (pattern.source.includes('max') || pattern.source.includes('limit')) {
          if (value > 10000) {
            return {
              ruleId: 'rate-limit/weak-config',
              ruleName: 'Weak Rate Limit Configuration',
              severity: 'info',
              tier: 'warn',
              message: `WEAK LIMIT: Rate limit of ${value} requests may be too high`,
              location: { file: ctx.filePath },
              suggestion: 'Consider lowering the rate limit for better protection',
            };
          }
        }
        
        // Check for very short windows
        if (pattern.source.includes('window')) {
          if (value < 1000) { // Less than 1 second
            return {
              ruleId: 'rate-limit/weak-config',
              ruleName: 'Weak Rate Limit Configuration',
              severity: 'info',
              tier: 'warn',
              message: `WEAK LIMIT: Rate limit window of ${value}ms may be too short`,
              location: { file: ctx.filePath },
              suggestion: 'Consider using a longer window (e.g., 60000ms for per-minute limits)',
            };
          }
        }
      }
    }

    return null;
  },
};

/**
 * Missing Retry-After Header Rule
 */
const missingRetryAfterRule: PolicyRule = {
  id: 'rate-limit/missing-retry-after',
  name: 'Missing Retry-After Header',
  description: 'Detects rate limit responses without Retry-After header',
  severity: 'info',
  category: 'rate-limit',
  tags: ['api', 'standards', 'ux'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    // Check for rate limit error responses
    const hasRateLimitError = /429|TooManyRequests|rateLimitExceeded/i.test(ctx.content);
    
    if (!hasRateLimitError) return null;

    // Check for Retry-After header
    const hasRetryAfter = /retry-after|retryAfter/i.test(ctx.content);
    
    if (!hasRetryAfter) {
      return {
        ruleId: 'rate-limit/missing-retry-after',
        ruleName: 'Missing Retry-After Header',
        severity: 'info',
        tier: 'warn',
        message: 'MISSING RETRY-AFTER: Rate limit responses should include Retry-After header',
        location: { file: ctx.filePath },
        suggestion: 'Add Retry-After header to help clients handle rate limits gracefully',
      };
    }

    return null;
  },
};

/**
 * Auth Endpoint Without Strict Limit Rule
 */
const authEndpointLimitRule: PolicyRule = {
  id: 'rate-limit/auth-endpoint',
  name: 'Auth Endpoint Rate Limit',
  description: 'Ensures authentication endpoints have strict rate limiting',
  severity: 'error',
  category: 'rate-limit',
  tags: ['security', 'auth', 'brute-force'],
  evaluate: (ctx: RuleContext): RuleViolation | null => {
    // Check if this is an auth-related file
    const isAuthFile = /auth|login|signin|signup|register|password/i.test(ctx.filePath);
    
    if (!isAuthFile) return null;

    // Check for rate limiting
    const hasRateLimit = containsKeyword(ctx.content, RATE_LIMIT_KEYWORDS);
    
    if (!hasRateLimit) {
      return {
        ruleId: 'rate-limit/auth-endpoint',
        ruleName: 'Auth Endpoint Rate Limit',
        severity: 'error',
        tier: 'hard_block',
        message: 'AUTH WITHOUT RATE LIMIT: Authentication endpoint lacks rate limiting',
        location: { file: ctx.filePath },
        suggestion: 'Add strict rate limiting (e.g., 5 attempts per minute) to prevent brute force attacks',
      };
    }

    return null;
  },
};

// ============================================================================
// Policy Pack Export
// ============================================================================

export const rateLimitPolicyPack: PolicyPack = {
  id: 'rate-limit',
  name: 'Rate Limiting & DoS Protection',
  description: 'Rules for rate limiting and denial-of-service protection',
  version: '0.1.0',
  rules: [
    missingRateLimitRule,
    expensiveOperationRule,
    weakRateLimitRule,
    missingRetryAfterRule,
    authEndpointLimitRule,
  ],
  defaultConfig: {
    enabled: true,
  },
};

export default rateLimitPolicyPack;
