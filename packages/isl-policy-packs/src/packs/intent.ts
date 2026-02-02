/**
 * Intent Pack - The ISL Studio Moat
 * 
 * Rules that enforce declared behavior (ISL specs) vs actual code patterns.
 * This is what makes ISL Studio different from ESLint/Bandit.
 * 
 * Example: if ISL says "no PII in logs", then code logging email triggers violation.
 * Example: "auth endpoints must be rate-limited" becomes enforceable from intent.
 */

import type { PolicyRule, RuleContext, RuleViolation } from '../types.js';

// PII field patterns
const PII_FIELDS = [
  'email', 'ssn', 'social_security', 'socialSecurity',
  'phone', 'address', 'dob', 'dateOfBirth', 'birth_date',
  'creditCard', 'credit_card', 'cardNumber', 'card_number',
  'password', 'secret', 'token', 'apiKey', 'api_key',
];

/**
 * Rule: pii-logging-intent
 * Enforces "no PII in logs" - always on by default
 */
export const piiLoggingIntent: PolicyRule = {
  id: 'intent/pii-logging',
  name: 'PII Logging Intent',
  description: 'Enforces "no PII in logs" - detects logged sensitive data',
  severity: 'error',
  category: 'intent',
  tags: ['pii', 'logging', 'privacy'],

  evaluate(context: RuleContext): RuleViolation | null {
    const content = context.content || '';
    
    const piiPattern = new RegExp(
      `console\\.(log|info|debug|warn|error)\\s*\\([^)]*\\b(${PII_FIELDS.join('|')})\\b`,
      'gi'
    );

    const match = piiPattern.exec(content);
    if (match) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      
      return {
        ruleId: 'intent/pii-logging',
        ruleName: 'PII Logging Intent',
        severity: 'error',
        message: `PII field "${match[2]}" logged - violates "no PII in logs" intent`,
        tier: 'hard_block',
        location: {
          file: context.filePath,
          line: lineNum,
        },
        suggestion: 'Remove PII from logs or mask sensitive data before logging',
        metadata: {
          intent: 'No PII should appear in application logs',
          field: match[2],
        },
      };
    }

    return null;
  },
};

/**
 * Rule: rate-limit-intent
 * Enforces "auth endpoints must be rate-limited"
 */
export const rateLimitIntent: PolicyRule = {
  id: 'intent/rate-limit-required',
  name: 'Rate Limit Intent',
  description: 'Enforces "rate-limited endpoints" - auth routes need rate limiting',
  severity: 'error',
  category: 'intent',
  tags: ['rate-limit', 'auth', 'security'],

  evaluate(context: RuleContext): RuleViolation | null {
    const content = context.content || '';

    // Check for auth endpoints without rate limiting
    const authRoutePattern = /\.(post|put)\s*\(\s*['"`](\/login|\/auth|\/register|\/signup|\/password|\/reset)/gi;
    const hasRateLimiter = /rateLimit|rateLimiter|throttle|slowDown/i.test(content);

    const match = authRoutePattern.exec(content);
    if (match && !hasRateLimiter) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      
      return {
        ruleId: 'intent/rate-limit-required',
        ruleName: 'Rate Limit Intent',
        severity: 'error',
        message: `Auth endpoint "${match[2]}" missing rate limiter`,
        tier: 'hard_block',
        location: {
          file: context.filePath,
          line: lineNum,
        },
        suggestion: 'Add rate limiting middleware (e.g., express-rate-limit)',
        metadata: {
          intent: 'All auth endpoints must have rate limiting',
          endpoint: match[2],
        },
      };
    }

    return null;
  },
};

/**
 * Rule: encryption-intent
 * Enforces "encrypt PII at rest" when declared
 */
export const encryptionIntent: PolicyRule = {
  id: 'intent/encryption-required',
  name: 'Encryption Intent',
  description: 'Enforces "encrypt PII at rest" declarations from ISL specs',
  severity: 'warning',
  category: 'intent',
  tags: ['encryption', 'pii', 'storage'],

  evaluate(context: RuleContext): RuleViolation | null {
    const content = context.content || '';

    // Only activate if encryption intent declared
    if (!content.includes('@intent encrypt-pii')) {
      return null;
    }

    // Check for PII storage without encryption
    const piiStoragePattern = /\.(save|create|insert|update)\s*\(\s*\{[^}]*(ssn|socialSecurity|creditCard|cardNumber)[^}]*\}/gi;
    const hasEncryption = /encrypt|cipher|crypto\.createCipher|aes/i.test(content);

    const match = piiStoragePattern.exec(content);
    if (match && !hasEncryption) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      
      return {
        ruleId: 'intent/encryption-required',
        ruleName: 'Encryption Intent',
        severity: 'warning',
        message: 'PII stored without encryption - violates "encrypt-pii" intent',
        tier: 'soft_block',
        location: {
          file: context.filePath,
          line: lineNum,
        },
        suggestion: 'Encrypt PII fields before storing in database',
        metadata: {
          intent: 'PII must be encrypted before storage',
        },
      };
    }

    return null;
  },
};

/**
 * Rule: audit-intent
 * Enforces "audit sensitive operations" when declared
 */
export const auditIntent: PolicyRule = {
  id: 'intent/audit-required',
  name: 'Audit Intent',
  description: 'Enforces "audit sensitive operations" declarations from ISL specs',
  severity: 'warning',
  category: 'intent',
  tags: ['audit', 'logging', 'compliance'],

  evaluate(context: RuleContext): RuleViolation | null {
    const content = context.content || '';

    // Only activate if audit intent declared
    if (!content.includes('@intent audit-sensitive')) {
      return null;
    }

    const sensitiveOps = [
      /delete.*user/i,
      /admin.*action/i,
      /role.*change/i,
      /permission.*update/i,
      /payment.*process/i,
    ];

    const hasAuditLog = /audit\.log|auditLog|logAudit|createAuditEntry/i.test(content);

    for (const pattern of sensitiveOps) {
      if (pattern.test(content) && !hasAuditLog) {
        return {
          ruleId: 'intent/audit-required',
          ruleName: 'Audit Intent',
          severity: 'warning',
          message: 'Sensitive operation without audit logging',
          tier: 'soft_block',
          location: {
            file: context.filePath,
          },
          suggestion: 'Add audit logging for sensitive operations',
          metadata: {
            intent: 'All sensitive operations must be audit logged',
          },
        };
      }
    }

    return null;
  },
};

/**
 * Rule: input-validation-intent
 * Enforces "validate all inputs" - API handlers should validate
 */
export const inputValidationIntent: PolicyRule = {
  id: 'intent/input-validation',
  name: 'Input Validation Intent',
  description: 'Enforces "validate all inputs" - API handlers should use schemas',
  severity: 'warning',
  category: 'intent',
  tags: ['validation', 'security', 'api'],

  evaluate(context: RuleContext): RuleViolation | null {
    const content = context.content || '';

    // Check for request handlers without validation
    const handlerPattern = /\.(get|post|put|patch|delete)\s*\([^,]+,\s*(async\s*)?\([^)]*req/gi;
    const hasValidation = /validate|schema|zod|yup|joi|ajv|class-validator/i.test(content);

    const match = handlerPattern.exec(content);
    if (match && !hasValidation) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      
      return {
        ruleId: 'intent/input-validation',
        ruleName: 'Input Validation Intent',
        severity: 'warning',
        message: 'Request handler may lack input validation',
        tier: 'warn',
        location: {
          file: context.filePath,
          line: lineNum,
        },
        suggestion: 'Add input validation using zod, yup, or similar',
        metadata: {
          intent: 'All request inputs should be validated',
        },
      };
    }

    return null;
  },
};

// Export all intent rules
export const intentRules: PolicyRule[] = [
  piiLoggingIntent,
  rateLimitIntent,
  encryptionIntent,
  auditIntent,
  inputValidationIntent,
];

// Export as policy pack
export const intentPolicyPack = {
  id: 'intent',
  name: 'Intent Pack',
  version: '0.1.0',
  description: 'Enforces declared ISL specifications against actual code patterns',
  rules: intentRules,
};

export default intentRules;
