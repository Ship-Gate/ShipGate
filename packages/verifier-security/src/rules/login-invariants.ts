// ============================================================================
// Login Invariants Security Rules
// ============================================================================
//
// These rules enforce the security invariants specified in login.isl:
// - password never_logged
// - password never_stored_plaintext
// - same error message for invalid email and password
//
// Rules are evaluated during ISL verify clause evaluation.

import type { DomainSecurityRule, SecurityFinding, RuleContext } from '../types.js';

/**
 * Check that password is never exposed in postconditions or outputs
 * 
 * Enforces: `password never_logged` invariant
 * 
 * CWE-532: Insertion of Sensitive Information into Log File
 */
export const passwordNeverLoggedRule: DomainSecurityRule = {
  id: 'SEC030',
  name: 'Password Never Logged',
  category: 'data-exposure',
  severity: 'critical',
  description: 'Verifies that password is never logged or exposed in outputs',
  check: (context: RuleContext): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const { domain } = context;

    for (const behavior of domain.behaviors) {
      // Check if this is a login-related behavior
      const isLoginBehavior = 
        behavior.name.toLowerCase().includes('login') ||
        behavior.name.toLowerCase().includes('authenticate') ||
        behavior.name.toLowerCase().includes('signin');

      // Check input for password field
      const hasPasswordInput = behavior.input && 
        Object.keys(behavior.input).some(k => 
          k.toLowerCase().includes('password') || 
          k.toLowerCase().includes('passwd') ||
          k.toLowerCase().includes('credential')
        );

      if (!isLoginBehavior && !hasPasswordInput) continue;

      // Check postconditions for password exposure
      const postconditions = behavior.postconditions ?? [];
      for (const post of postconditions) {
        // Check for password being logged
        if (post.includes('log') && post.includes('password')) {
          findings.push({
            id: 'SEC030',
            category: 'data-exposure',
            severity: 'critical',
            title: 'Password Logged in Postcondition',
            description: `Postcondition in '${behavior.name}' may log password`,
            location: { domain: domain.name, behavior: behavior.name },
            recommendation: 'Never log passwords. Remove password from logging statements.',
            cweId: 'CWE-532',
            owaspId: 'A03:2021',
            evidence: post,
          });
        }

        // Check for password in output
        if (post.includes('output') && post.includes('password') && !post.includes('_hash')) {
          findings.push({
            id: 'SEC030',
            category: 'data-exposure',
            severity: 'critical',
            title: 'Password in Output',
            description: `Postcondition in '${behavior.name}' may expose password in output`,
            location: { domain: domain.name, behavior: behavior.name },
            recommendation: 'Never return passwords in API responses.',
            cweId: 'CWE-200',
            owaspId: 'A01:2021',
            evidence: post,
          });
        }
      }

      // Check output definition for password exposure
      if (behavior.output) {
        for (const [outputName, outputDef] of Object.entries(behavior.output)) {
          const nameLower = outputName.toLowerCase();
          if ((nameLower.includes('password') || nameLower.includes('passwd')) && 
              !nameLower.includes('_hash') && !nameLower.includes('hash')) {
            findings.push({
              id: 'SEC030',
              category: 'data-exposure',
              severity: 'critical',
              title: 'Password in Output Schema',
              description: `Output '${outputName}' in '${behavior.name}' exposes password`,
              location: { domain: domain.name, behavior: behavior.name },
              recommendation: 'Remove password from output. Only return session tokens or user IDs.',
              cweId: 'CWE-200',
              owaspId: 'A01:2021',
            });
          }
        }
      }

      // Check that behavior has never_logged invariant for sensitive inputs
      if (hasPasswordInput) {
        // Look for the invariant declaration
        const hasNeverLoggedInvariant = postconditions.some(p => 
          p.includes('never_logged') || p.includes('neverLogged')
        );

        if (!hasNeverLoggedInvariant) {
          findings.push({
            id: 'SEC030',
            category: 'data-exposure',
            severity: 'high',
            title: 'Missing never_logged Invariant',
            description: `Behavior '${behavior.name}' has password input but no never_logged invariant`,
            location: { domain: domain.name, behavior: behavior.name },
            recommendation: 'Add invariant: password.never_logged()',
            cweId: 'CWE-532',
          });
        }
      }
    }

    return findings;
  },
};

/**
 * Check that password is never stored in plaintext
 * 
 * Enforces: `password never_stored_plaintext` invariant
 * 
 * CWE-256: Plaintext Storage of a Password
 */
export const passwordNeverStoredPlaintextRule: DomainSecurityRule = {
  id: 'SEC031',
  name: 'Password Never Stored Plaintext',
  category: 'cryptography',
  severity: 'critical',
  description: 'Verifies that password is hashed before storage',
  check: (context: RuleContext): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const { domain } = context;

    // Check entities for password storage
    for (const entity of domain.entities ?? []) {
      const passwordFields = Object.entries(entity.properties)
        .filter(([name]) => 
          name.toLowerCase().includes('password') || 
          name.toLowerCase().includes('passwd')
        );

      for (const [fieldName, fieldDef] of passwordFields) {
        // Check if field is named password (not password_hash)
        if (!fieldName.includes('hash') && !fieldName.includes('_hash')) {
          findings.push({
            id: 'SEC031',
            category: 'cryptography',
            severity: 'critical',
            title: 'Plaintext Password Storage',
            description: `Entity '${entity.name}' has field '${fieldName}' that may store plaintext password`,
            location: { domain: domain.name },
            recommendation: 'Store password as hash. Rename to password_hash and use bcrypt/argon2.',
            cweId: 'CWE-256',
            owaspId: 'A02:2021',
          });
        }

        // Check if marked as secret/encrypted
        if (!fieldDef.encrypted && fieldName.includes('hash')) {
          findings.push({
            id: 'SEC031',
            category: 'cryptography',
            severity: 'medium',
            title: 'Password Hash Not Marked Secret',
            description: `Field '${fieldName}' should be marked as [secret]`,
            location: { domain: domain.name },
            recommendation: 'Mark password_hash field as [secret] for additional protection.',
          });
        }
      }
    }

    // Check behaviors for password storage operations
    for (const behavior of domain.behaviors) {
      const postconditions = behavior.postconditions ?? [];
      
      for (const post of postconditions) {
        // Check for direct password storage
        if (post.includes('password') && 
            (post.includes('save') || post.includes('create') || post.includes('insert')) &&
            !post.includes('hash')) {
          findings.push({
            id: 'SEC031',
            category: 'cryptography',
            severity: 'critical',
            title: 'Direct Password Storage',
            description: `Postcondition in '${behavior.name}' may store password without hashing`,
            location: { domain: domain.name, behavior: behavior.name },
            recommendation: 'Hash password before storage: password_hash = hash(password)',
            cweId: 'CWE-256',
            owaspId: 'A02:2021',
            evidence: post,
          });
        }
      }
    }

    return findings;
  },
};

/**
 * Check for consistent error messages to prevent user enumeration
 * 
 * Enforces: same error message for invalid email and password
 * 
 * CWE-203: Observable Discrepancy
 */
export const errorMessageConsistencyRule: DomainSecurityRule = {
  id: 'SEC032',
  name: 'Error Message Consistency',
  category: 'authentication',
  severity: 'high',
  description: 'Verifies same error for invalid email and password to prevent enumeration',
  check: (context: RuleContext): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const { domain } = context;

    for (const behavior of domain.behaviors) {
      // Check if this is a login-related behavior
      const isLoginBehavior = 
        behavior.name.toLowerCase().includes('login') ||
        behavior.name.toLowerCase().includes('authenticate') ||
        behavior.name.toLowerCase().includes('signin');

      if (!isLoginBehavior) continue;

      const postconditions = behavior.postconditions ?? [];
      
      // Patterns that indicate distinct error handling
      const hasUserNotFound = postconditions.some(p => 
        p.toLowerCase().includes('user_not_found') ||
        p.toLowerCase().includes('usernotfound') ||
        p.toLowerCase().includes('email_not_found') ||
        p.toLowerCase().includes('account_not_found') ||
        p.toLowerCase().includes('no user') ||
        p.toLowerCase().includes('unknown user')
      );

      const hasWrongPassword = postconditions.some(p => 
        p.toLowerCase().includes('wrong_password') ||
        p.toLowerCase().includes('wrongpassword') ||
        p.toLowerCase().includes('invalid_password') ||
        p.toLowerCase().includes('incorrect_password') ||
        p.toLowerCase().includes('bad_password')
      );

      if (hasUserNotFound) {
        findings.push({
          id: 'SEC032',
          category: 'authentication',
          severity: 'high',
          title: 'User Enumeration - User Not Found',
          description: `Behavior '${behavior.name}' has distinct 'user not found' error`,
          location: { domain: domain.name, behavior: behavior.name },
          recommendation: 'Use generic error like INVALID_CREDENTIALS for all auth failures',
          cweId: 'CWE-203',
          owaspId: 'A07:2021',
        });
      }

      if (hasWrongPassword) {
        findings.push({
          id: 'SEC032',
          category: 'authentication',
          severity: 'high',
          title: 'User Enumeration - Wrong Password',
          description: `Behavior '${behavior.name}' has distinct 'wrong password' error`,
          location: { domain: domain.name, behavior: behavior.name },
          recommendation: 'Use generic error like INVALID_CREDENTIALS for all auth failures',
          cweId: 'CWE-203',
          owaspId: 'A07:2021',
        });
      }

      // Check that INVALID_CREDENTIALS or equivalent is used
      const hasGenericError = postconditions.some(p => 
        p.toLowerCase().includes('invalid_credentials') ||
        p.toLowerCase().includes('invalidcredentials') ||
        p.toLowerCase().includes('authentication_failed') ||
        p.toLowerCase().includes('auth_error')
      );

      if (!hasGenericError && (hasUserNotFound || hasWrongPassword)) {
        findings.push({
          id: 'SEC032',
          category: 'authentication',
          severity: 'medium',
          title: 'Missing Generic Error',
          description: `Behavior '${behavior.name}' lacks generic INVALID_CREDENTIALS error`,
          location: { domain: domain.name, behavior: behavior.name },
          recommendation: 'Define INVALID_CREDENTIALS error that covers both user-not-found and wrong-password cases',
        });
      }
    }

    return findings;
  },
};

/**
 * Check for timing attack prevention in login
 * 
 * CWE-208: Observable Timing Discrepancy
 */
export const timingAttackPreventionRule: DomainSecurityRule = {
  id: 'SEC033',
  name: 'Timing Attack Prevention',
  category: 'authentication',
  severity: 'medium',
  description: 'Verifies constant-time response for authentication',
  check: (context: RuleContext): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const { domain } = context;

    for (const behavior of domain.behaviors) {
      // Check if this is a login-related behavior
      const isLoginBehavior = 
        behavior.name.toLowerCase().includes('login') ||
        behavior.name.toLowerCase().includes('authenticate');

      if (!isLoginBehavior) continue;

      const postconditions = behavior.postconditions ?? [];
      
      // Check for constant-time declaration
      const hasConstantTime = postconditions.some(p => 
        p.includes('constant') || 
        p.includes('timing') ||
        p.includes('constant_time')
      );

      if (!hasConstantTime) {
        findings.push({
          id: 'SEC033',
          category: 'authentication',
          severity: 'medium',
          title: 'Missing Timing Attack Prevention',
          description: `Login behavior '${behavior.name}' lacks constant-time guarantee`,
          location: { domain: domain.name, behavior: behavior.name },
          recommendation: 'Ensure consistent response time regardless of user existence',
          cweId: 'CWE-208',
          owaspId: 'A07:2021',
        });
      }
    }

    return findings;
  },
};

/**
 * Check for audit trail in login
 */
export const loginAuditTrailRule: DomainSecurityRule = {
  id: 'SEC034',
  name: 'Login Audit Trail',
  category: 'authentication',
  severity: 'medium',
  description: 'Verifies that login attempts are audited',
  check: (context: RuleContext): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const { domain } = context;

    for (const behavior of domain.behaviors) {
      // Check if this is a login-related behavior
      const isLoginBehavior = 
        behavior.name.toLowerCase().includes('login') ||
        behavior.name.toLowerCase().includes('authenticate');

      if (!isLoginBehavior) continue;

      const postconditions = behavior.postconditions ?? [];
      
      // Check for audit trail
      const hasAudit = postconditions.some(p => 
        p.includes('audit') || 
        p.includes('log') ||
        p.includes('record')
      );

      if (!hasAudit) {
        findings.push({
          id: 'SEC034',
          category: 'authentication',
          severity: 'medium',
          title: 'Missing Login Audit',
          description: `Login behavior '${behavior.name}' lacks audit trail`,
          location: { domain: domain.name, behavior: behavior.name },
          recommendation: 'Add audit logging for login success and failure events',
        });
      }
    }

    return findings;
  },
};

/**
 * All login invariant rules
 */
export const loginInvariantRules: DomainSecurityRule[] = [
  passwordNeverLoggedRule,
  passwordNeverStoredPlaintextRule,
  errorMessageConsistencyRule,
  timingAttackPreventionRule,
  loginAuditTrailRule,
];
