// ============================================================================
// Policy: Auth Endpoints Require Rate Limit
// ============================================================================

import type { PolicyRule, Finding, RuleContext, Behavior, ASTFix } from '../types.js';

/**
 * Auth behavior patterns
 */
const AUTH_PATTERNS = [
  /login/i,
  /signin/i,
  /sign[_-]?in/i,
  /authenticate/i,
  /auth/i,
  /register/i,
  /signup/i,
  /sign[_-]?up/i,
  /password[_-]?reset/i,
  /reset[_-]?password/i,
  /forgot[_-]?password/i,
  /change[_-]?password/i,
  /verify[_-]?email/i,
  /verify[_-]?phone/i,
  /verify[_-]?otp/i,
  /verify[_-]?mfa/i,
  /mfa/i,
  /two[_-]?factor/i,
  /2fa/i,
  /totp/i,
  /token[_-]?refresh/i,
  /refresh[_-]?token/i,
  /oauth/i,
  /sso/i,
  /session/i,
];

/**
 * Sensitive operation patterns that require rate limiting
 */
const SENSITIVE_PATTERNS = [
  /payment/i,
  /transfer/i,
  /withdraw/i,
  /payout/i,
  /send[_-]?money/i,
  /create[_-]?account/i,
  /delete[_-]?account/i,
  /api[_-]?key/i,
  /generate[_-]?token/i,
];

/**
 * Check if behavior is auth-related
 */
function isAuthBehavior(behavior: Behavior): boolean {
  const name = behavior.name.name;
  return AUTH_PATTERNS.some(pattern => pattern.test(name));
}

/**
 * Check if behavior is sensitive
 */
function isSensitiveBehavior(behavior: Behavior): boolean {
  const name = behavior.name.name;
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(name));
}

/**
 * Check if behavior has rate limiting
 */
function hasRateLimit(behavior: Behavior): boolean {
  // Check security specs for rate_limit
  const hasRateLimitSpec = behavior.security.some(
    spec => spec.type === 'rate_limit'
  );
  if (hasRateLimitSpec) return true;

  // Check for rate limit in preconditions
  const preconditionStr = behavior.preconditions
    .map(p => JSON.stringify(p))
    .join(' ');
  
  return preconditionStr.includes('rate_limit') || 
         preconditionStr.includes('throttle') ||
         preconditionStr.includes('requests_per');
}

/**
 * Get rate limit details if present
 */
function getRateLimitDetails(behavior: Behavior): { limit?: number; per?: string } | null {
  const rateLimitSpec = behavior.security.find(spec => spec.type === 'rate_limit');
  if (!rateLimitSpec) return null;

  // Extract details from the spec
  const detailsStr = JSON.stringify(rateLimitSpec.details);
  const limitMatch = detailsStr.match(/(\d+)/);
  const perMatch = detailsStr.match(/per[_\s]*([\w_]+)/i);

  return {
    limit: limitMatch ? parseInt(limitMatch[1], 10) : undefined,
    per: perMatch ? perMatch[1] : undefined,
  };
}

/**
 * Generate autofix for adding rate limit
 */
function generateRateLimitFix(behavior: Behavior, isAuth: boolean): ASTFix {
  const limit = isAuth ? 5 : 10;
  const key = isAuth ? 'ip_address' : 'user_id';
  
  return {
    description: `Add rate limiting to '${behavior.name.name}'`,
    operation: 'add',
    targetKind: 'SecuritySpec',
    location: behavior.location,
    patch: {
      position: 'inside',
      text: `
    security {
      rate_limit ${limit} per ${key}
    }`,
    },
  };
}

/**
 * Auth Rate Limit Required Rule
 */
export const authRateLimitRule: PolicyRule = {
  id: 'SEC-RATE-001',
  name: 'Auth Endpoints Require Rate Limit',
  category: 'rate-limiting',
  severity: 'error',
  description: 'Authentication endpoints must have rate limiting to prevent brute force attacks',
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      if (isAuthBehavior(b) && !hasRateLimit(b)) {
        findings.push({
          id: 'SEC-RATE-001',
          category: 'rate-limiting',
          severity: 'error',
          title: 'Auth Endpoint Missing Rate Limit',
          message: `Authentication behavior '${b.name.name}' does not have rate limiting`,
          location: b.location,
          behaviorName: b.name.name,
          suggestion: 'Add rate_limit in security block (recommended: 5 per ip_address for auth)',
          autofix: generateRateLimitFix(b, true),
        });
      }
    }

    return findings;
  },
};

/**
 * Auth Rate Limit Strictness Rule
 */
export const authRateLimitStrictnessRule: PolicyRule = {
  id: 'SEC-RATE-002',
  name: 'Auth Rate Limit Too Permissive',
  category: 'rate-limiting',
  severity: 'warning',
  description: 'Authentication rate limits should be strict (recommended: 5-10 per minute)',
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      if (isAuthBehavior(b) && hasRateLimit(b)) {
        const details = getRateLimitDetails(b);
        
        if (details?.limit && details.limit > 20) {
          findings.push({
            id: 'SEC-RATE-002',
            category: 'rate-limiting',
            severity: 'warning',
            title: 'Auth Rate Limit Too Permissive',
            message: `Authentication behavior '${b.name.name}' has rate limit of ${details.limit}, which may be too permissive`,
            location: b.location,
            behaviorName: b.name.name,
            suggestion: 'Consider reducing rate limit to 5-10 requests per minute for authentication endpoints',
          });
        }
      }
    }

    return findings;
  },
};

/**
 * Sensitive Operations Rate Limit Rule
 */
export const sensitiveRateLimitRule: PolicyRule = {
  id: 'SEC-RATE-003',
  name: 'Sensitive Operations Require Rate Limit',
  category: 'rate-limiting',
  severity: 'warning',
  description: 'Sensitive operations (payments, transfers) should have rate limiting',
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      if (isSensitiveBehavior(b) && !hasRateLimit(b)) {
        findings.push({
          id: 'SEC-RATE-003',
          category: 'rate-limiting',
          severity: 'warning',
          title: 'Sensitive Operation Missing Rate Limit',
          message: `Sensitive behavior '${b.name.name}' does not have rate limiting`,
          location: b.location,
          behaviorName: b.name.name,
          suggestion: 'Add rate_limit in security block to prevent abuse',
          autofix: generateRateLimitFix(b, false),
        });
      }
    }

    return findings;
  },
};

/**
 * Rate Limit by IP for Anonymous Endpoints Rule
 */
export const anonymousRateLimitRule: PolicyRule = {
  id: 'SEC-RATE-004',
  name: 'Anonymous Endpoints Rate Limit by IP',
  category: 'rate-limiting',
  severity: 'warning',
  description: 'Anonymous endpoints should rate limit by IP address',
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      // Check if behavior allows anonymous access
      const isAnonymous = !b.security.some(s => 
        s.type === 'requires' && 
        (JSON.stringify(s.details).includes('auth') ||
         JSON.stringify(s.details).includes('authenticated'))
      );

      if (isAnonymous && hasRateLimit(b)) {
        const details = getRateLimitDetails(b);
        
        // Check if rate limit is by IP
        if (details?.per && !details.per.toLowerCase().includes('ip')) {
          findings.push({
            id: 'SEC-RATE-004',
            category: 'rate-limiting',
            severity: 'warning',
            title: 'Anonymous Endpoint Rate Limit Not By IP',
            message: `Anonymous behavior '${b.name.name}' should rate limit by IP address, not '${details.per}'`,
            location: b.location,
            behaviorName: b.name.name,
            suggestion: 'Use ip_address as rate limit key for anonymous endpoints',
          });
        }
      }
    }

    return findings;
  },
};

export const rateLimitingPolicies: PolicyRule[] = [
  authRateLimitRule,
  authRateLimitStrictnessRule,
  sensitiveRateLimitRule,
  anonymousRateLimitRule,
];
