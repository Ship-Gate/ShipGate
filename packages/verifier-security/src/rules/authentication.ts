// ============================================================================
// Authentication Security Rules
// ============================================================================

import type { SecurityRule, SecurityFinding, RuleContext, Behavior } from '../types.js';

/**
 * Check for missing authentication
 */
export const missingAuthenticationRule: SecurityRule = {
  id: 'SEC001',
  name: 'Missing Authentication',
  category: 'authentication',
  severity: 'critical',
  description: 'Behavior exposes sensitive operations without authentication',
  check: (context: RuleContext): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const { domain, behavior } = context;

    if (!behavior) {
      // Check all behaviors
      for (const b of domain.behaviors) {
        const finding = checkBehaviorAuth(domain.name, b);
        if (finding) findings.push(finding);
      }
    } else {
      const finding = checkBehaviorAuth(domain.name, behavior);
      if (finding) findings.push(finding);
    }

    return findings;
  },
};

function checkBehaviorAuth(domainName: string, behavior: Behavior): SecurityFinding | null {
  const sensitiveOperations = [
    'create', 'update', 'delete', 'modify', 'remove',
    'admin', 'manage', 'configure', 'payment', 'transfer',
  ];

  const requiresAuth = sensitiveOperations.some(op => 
    behavior.name.toLowerCase().includes(op)
  );

  if (requiresAuth && !behavior.auth?.required) {
    return {
      id: 'SEC001',
      category: 'authentication',
      severity: 'critical',
      title: 'Missing Authentication',
      description: `Behavior '${behavior.name}' performs sensitive operations without authentication requirement`,
      location: { domain: domainName, behavior: behavior.name },
      recommendation: 'Add authentication requirement to this behavior using the auth property',
      cweId: 'CWE-306',
      owaspId: 'A07:2021',
    };
  }

  return null;
}

/**
 * Check for weak authentication methods
 */
export const weakAuthMethodRule: SecurityRule = {
  id: 'SEC002',
  name: 'Weak Authentication Method',
  category: 'authentication',
  severity: 'high',
  description: 'Using weak or deprecated authentication methods',
  check: (context: RuleContext): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const { domain } = context;

    const weakMethods = ['basic', 'digest', 'plain'];
    const configuredMethods = domain.config?.authentication?.methods ?? [];

    for (const method of configuredMethods) {
      if (weakMethods.includes(method.toLowerCase())) {
        findings.push({
          id: 'SEC002',
          category: 'authentication',
          severity: 'high',
          title: 'Weak Authentication Method',
          description: `Authentication method '${method}' is considered weak`,
          location: { domain: domain.name },
          recommendation: 'Use stronger authentication methods like OAuth2, JWT, or API keys with proper rotation',
          cweId: 'CWE-287',
          owaspId: 'A07:2021',
          evidence: `method: ${method}`,
        });
      }
    }

    return findings;
  },
};

/**
 * Check for missing token validation
 */
export const missingTokenValidationRule: SecurityRule = {
  id: 'SEC003',
  name: 'Missing Token Validation',
  category: 'authentication',
  severity: 'high',
  description: 'Token-based auth without proper validation specified',
  check: (context: RuleContext): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const { domain } = context;

    if (domain.config?.authentication?.required && 
        !domain.config.authentication.tokenValidation) {
      findings.push({
        id: 'SEC003',
        category: 'authentication',
        severity: 'high',
        title: 'Missing Token Validation',
        description: 'Authentication is required but token validation is not explicitly configured',
        location: { domain: domain.name },
        recommendation: 'Enable token validation to verify token signature, expiration, and issuer',
        cweId: 'CWE-287',
        owaspId: 'A07:2021',
      });
    }

    return findings;
  },
};

/**
 * Check for password handling in preconditions
 */
export const passwordExposureRule: SecurityRule = {
  id: 'SEC004',
  name: 'Password Exposure in Conditions',
  category: 'authentication',
  severity: 'medium',
  description: 'Password or credentials referenced in preconditions/postconditions',
  check: (context: RuleContext): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const { domain } = context;

    const sensitivePatterns = [
      /password/i, /passwd/i, /secret/i, /credential/i,
      /api_key/i, /apikey/i, /token/i, /auth.*key/i,
    ];

    for (const behavior of domain.behaviors) {
      const conditions = [
        ...(behavior.preconditions ?? []),
        ...(behavior.postconditions ?? []),
      ];

      for (const condition of conditions) {
        for (const pattern of sensitivePatterns) {
          if (pattern.test(condition)) {
            findings.push({
              id: 'SEC004',
              category: 'authentication',
              severity: 'medium',
              title: 'Credential Reference in Condition',
              description: `Behavior '${behavior.name}' references credentials in conditions`,
              location: { domain: domain.name, behavior: behavior.name },
              recommendation: 'Avoid referencing credentials in preconditions/postconditions. Use abstracted auth checks instead.',
              cweId: 'CWE-522',
              evidence: condition,
            });
            break;
          }
        }
      }
    }

    return findings;
  },
};

export const authenticationRules: SecurityRule[] = [
  missingAuthenticationRule,
  weakAuthMethodRule,
  missingTokenValidationRule,
  passwordExposureRule,
];
