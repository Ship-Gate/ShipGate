// ============================================================================
// Lint Rule: Auth Behavior Constraints
// ============================================================================

import type { LintRule, Finding, RuleContext, Behavior, ASTFix, RequiredConstraint } from '../../types.js';

/**
 * Auth behavior patterns
 */
const AUTH_PATTERNS = [
  /^login$/i,
  /^signin$/i,
  /^sign[_-]?in$/i,
  /^authenticate$/i,
  /^register$/i,
  /^signup$/i,
  /^sign[_-]?up$/i,
  /^create[_-]?user$/i,
  /^create[_-]?account$/i,
  /password[_-]?reset/i,
  /reset[_-]?password/i,
  /forgot[_-]?password/i,
  /change[_-]?password/i,
  /verify[_-]?email/i,
  /verify[_-]?phone/i,
  /verify[_-]?otp/i,
  /verify[_-]?mfa/i,
  /^mfa$/i,
  /two[_-]?factor/i,
  /^2fa$/i,
  /^totp$/i,
  /token[_-]?refresh/i,
  /refresh[_-]?token/i,
  /^logout$/i,
  /^signout$/i,
  /^sign[_-]?out$/i,
];

/**
 * Required constraints for auth behaviors
 */
const AUTH_REQUIRED_CONSTRAINTS: RequiredConstraint[] = [
  {
    type: 'rate_limit',
    description: 'Rate limiting to prevent brute force attacks',
    severity: 'error',
  },
  {
    type: 'logging',
    description: 'Audit logging for security monitoring',
    severity: 'warning',
  },
  {
    type: 'validation',
    description: 'Input validation for email/password',
    severity: 'warning',
  },
];

/**
 * Check if behavior has rate limit
 */
function hasRateLimit(behavior: Behavior): boolean {
  return behavior.security.some(s => s.type === 'rate_limit');
}

/**
 * Check if behavior has audit logging
 */
function hasAuditLogging(behavior: Behavior): boolean {
  if (!behavior.observability) return false;
  
  // Check for audit log in postconditions
  const postStr = behavior.postconditions
    .map(p => JSON.stringify(p))
    .join(' ');
  
  return postStr.includes('AuditLog') || 
         behavior.observability.logs.length > 0;
}

/**
 * Check if behavior has input validation
 */
function hasInputValidation(behavior: Behavior): boolean {
  const preStr = behavior.preconditions
    .map(p => JSON.stringify(p))
    .join(' ');
  
  return preStr.includes('length') || 
         preStr.includes('valid') ||
         preStr.includes('format') ||
         behavior.input.fields.some(f => 
           f.annotations.some(a => 
             ['validate', 'format', 'regex'].includes(a.name.name.toLowerCase())
           )
         );
}

/**
 * Check if behavior has password safety invariant
 */
function hasPasswordSafetyInvariant(behavior: Behavior): boolean {
  const hasPasswordInput = behavior.input.fields.some(
    f => /password/i.test(f.name.name)
  );
  
  if (!hasPasswordInput) return true;
  
  const invStr = behavior.invariants
    .map(i => JSON.stringify(i))
    .join(' ');
  
  return invStr.includes('never_appears_in') || 
         invStr.includes('password') && invStr.includes('log');
}

/**
 * Generate rate limit autofix
 */
function generateRateLimitFix(behavior: Behavior): ASTFix {
  return {
    description: `Add rate limiting to auth behavior '${behavior.name.name}'`,
    operation: 'add',
    targetKind: 'SecuritySpec',
    location: behavior.location,
    patch: {
      position: 'inside',
      text: `
    security {
      rate_limit 5 per ip_address
    }`,
    },
  };
}

/**
 * Generate audit logging autofix
 */
function generateAuditLoggingFix(behavior: Behavior): ASTFix {
  return {
    description: `Add audit logging to auth behavior '${behavior.name.name}'`,
    operation: 'add',
    targetKind: 'PostconditionBlock',
    location: behavior.location,
    patch: {
      position: 'inside',
      text: `
    postconditions {
      success implies {
        AuditLog.exists(action: "${behavior.name.name.toUpperCase()}")
      }
    }`,
    },
  };
}

/**
 * Generate password safety invariant autofix
 */
function generatePasswordSafetyFix(behavior: Behavior): ASTFix {
  const passwordFields = behavior.input.fields
    .filter(f => /password/i.test(f.name.name))
    .map(f => f.name.name);
  
  const invariants = passwordFields
    .map(f => `      input.${f} never_appears_in logs\n      input.${f} never_appears_in result`)
    .join('\n');
  
  return {
    description: `Add password safety invariants to '${behavior.name.name}'`,
    operation: 'add',
    targetKind: 'Expression',
    location: behavior.location,
    patch: {
      position: 'inside',
      text: `
    invariants {
${invariants}
    }`,
    },
  };
}

/**
 * Auth Constraints Lint Rule
 */
export const authConstraintsRule: LintRule = {
  id: 'LINT-AUTH-001',
  name: 'Auth Behavior Minimum Constraints',
  category: 'auth-security',
  severity: 'error',
  description: 'Auth behaviors must have rate limiting, audit logging, and input validation',
  matchPatterns: AUTH_PATTERNS,
  requiredConstraints: AUTH_REQUIRED_CONSTRAINTS,
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      // Check if this is an auth behavior
      const isAuth = AUTH_PATTERNS.some(pattern => pattern.test(b.name.name));
      if (!isAuth) continue;

      // Check rate limiting
      if (!hasRateLimit(b)) {
        findings.push({
          id: 'LINT-AUTH-001',
          category: 'auth-security',
          severity: 'error',
          title: 'Auth Behavior Missing Rate Limit',
          message: `Auth behavior '${b.name.name}' requires rate limiting`,
          location: b.location,
          behaviorName: b.name.name,
          suggestion: 'Add: security { rate_limit 5 per ip_address }',
          autofix: generateRateLimitFix(b),
        });
      }

      // Check audit logging
      if (!hasAuditLogging(b)) {
        findings.push({
          id: 'LINT-AUTH-001',
          category: 'auth-security',
          severity: 'warning',
          title: 'Auth Behavior Missing Audit Logging',
          message: `Auth behavior '${b.name.name}' should have audit logging`,
          location: b.location,
          behaviorName: b.name.name,
          suggestion: 'Add audit log creation in postconditions',
          autofix: generateAuditLoggingFix(b),
        });
      }

      // Check password safety
      if (!hasPasswordSafetyInvariant(b)) {
        findings.push({
          id: 'LINT-AUTH-001',
          category: 'auth-security',
          severity: 'error',
          title: 'Auth Behavior Missing Password Safety',
          message: `Auth behavior '${b.name.name}' has password input without safety invariant`,
          location: b.location,
          behaviorName: b.name.name,
          suggestion: 'Add: input.password never_appears_in logs',
          autofix: generatePasswordSafetyFix(b),
        });
      }

      // Check input validation
      if (!hasInputValidation(b)) {
        findings.push({
          id: 'LINT-AUTH-001',
          category: 'auth-security',
          severity: 'warning',
          title: 'Auth Behavior Missing Input Validation',
          message: `Auth behavior '${b.name.name}' should validate input fields`,
          location: b.location,
          behaviorName: b.name.name,
          suggestion: 'Add preconditions to validate email format and password length',
        });
      }
    }

    return findings;
  },
};

/**
 * Session Security Rule
 */
export const sessionSecurityRule: LintRule = {
  id: 'LINT-AUTH-002',
  name: 'Session Security Requirements',
  category: 'auth-security',
  severity: 'warning',
  description: 'Session-related behaviors should have proper security constraints',
  matchPatterns: [/session/i, /token/i, /logout/i],
  requiredConstraints: [
    { type: 'auth', description: 'Authentication required', severity: 'error' },
  ],
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      const isSession = [/session/i, /token/i, /logout/i].some(p => p.test(b.name.name));
      if (!isSession) continue;

      // Session behaviors (except login) should require authentication
      const isLogin = /login|signin|authenticate/i.test(b.name.name);
      if (!isLogin) {
        const hasAuthRequirement = b.security.some(
          s => s.type === 'requires' && JSON.stringify(s.details).includes('auth')
        );
        
        if (!hasAuthRequirement) {
          findings.push({
            id: 'LINT-AUTH-002',
            category: 'auth-security',
            severity: 'warning',
            title: 'Session Behavior Should Require Auth',
            message: `Session behavior '${b.name.name}' should require authentication`,
            location: b.location,
            behaviorName: b.name.name,
            suggestion: 'Add: security { requires authenticated }',
            autofix: {
              description: `Add auth requirement to '${b.name.name}'`,
              operation: 'add',
              targetKind: 'SecuritySpec',
              location: b.location,
              patch: {
                position: 'inside',
                text: `
    security {
      requires authenticated
    }`,
              },
            },
          });
        }
      }
    }

    return findings;
  },
};

export const authLintRules: LintRule[] = [
  authConstraintsRule,
  sessionSecurityRule,
];
