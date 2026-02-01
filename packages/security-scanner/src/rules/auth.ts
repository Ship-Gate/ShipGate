// ============================================================================
// Authentication Security Rules
// SEC001: Missing Authentication
// SEC002: Missing Rate Limiting
// ============================================================================

import {
  SecurityRule,
  Finding,
  RuleContext,
  Behavior,
  Field,
} from '../severity';

// ============================================================================
// Helper Functions
// ============================================================================

const SENSITIVE_FIELD_NAMES = [
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'credit_card',
  'ssn',
  'social_security',
  'bank_account',
  'routing_number',
];

const PII_FIELD_NAMES = [
  'email',
  'phone',
  'address',
  'name',
  'first_name',
  'last_name',
  'date_of_birth',
  'dob',
  'ssn',
  'social_security',
  'passport',
  'driver_license',
  'ip_address',
];

function hasAnnotation(field: Field, annotationName: string): boolean {
  return field.annotations.some(
    (a) => a.name.name.toLowerCase() === annotationName.toLowerCase()
  );
}

function isSensitiveField(field: Field): boolean {
  const fieldName = field.name.name.toLowerCase();
  return (
    hasAnnotation(field, 'sensitive') ||
    hasAnnotation(field, 'secret') ||
    SENSITIVE_FIELD_NAMES.some((name) => fieldName.includes(name))
  );
}

function isPIIField(field: Field): boolean {
  const fieldName = field.name.name.toLowerCase();
  return (
    hasAnnotation(field, 'pii') ||
    PII_FIELD_NAMES.some((name) => fieldName.includes(name))
  );
}

function handlesSensitiveData(behavior: Behavior): { handles: boolean; fields: string[] } {
  const sensitiveFields: string[] = [];

  // Check input fields
  for (const field of behavior.input.fields) {
    if (isSensitiveField(field) || isPIIField(field)) {
      sensitiveFields.push(`input.${field.name.name}`);
    }
  }

  return {
    handles: sensitiveFields.length > 0,
    fields: sensitiveFields,
  };
}

function hasAuthentication(behavior: Behavior): boolean {
  // Check actors for authentication requirements
  if (behavior.actors) {
    for (const actor of behavior.actors) {
      const actorName = actor.name.name.toLowerCase();
      if (actorName !== 'anonymous' && actorName !== 'public') {
        return true;
      }
      // Check constraints for authentication
      // In a real implementation, we'd parse the constraints
    }
  }

  // Check security specs
  for (const spec of behavior.security) {
    if (spec.type === 'requires') {
      return true;
    }
  }

  return false;
}

function hasRateLimiting(behavior: Behavior): boolean {
  for (const spec of behavior.security) {
    if (spec.type === 'rate_limit') {
      return true;
    }
  }
  return false;
}

function isPublicBehavior(behavior: Behavior): boolean {
  if (!behavior.actors || behavior.actors.length === 0) {
    return true; // No actors specified, assume public
  }

  return behavior.actors.some((actor) => {
    const name = actor.name.name.toLowerCase();
    return name === 'anonymous' || name === 'public' || name === 'system';
  });
}

// ============================================================================
// SEC001: Missing Authentication
// ============================================================================

export const SEC001_MissingAuthentication: SecurityRule = {
  id: 'SEC001',
  title: 'Missing Authentication',
  description:
    'Behavior handles sensitive data but does not require authentication. ' +
    'This could allow unauthorized access to sensitive information.',
  severity: 'high',
  category: 'authentication',
  cwe: 'CWE-306',
  owasp: 'A01:2021',

  check(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { domain } = context;

    for (const behavior of domain.behaviors) {
      const sensitiveData = handlesSensitiveData(behavior);

      if (sensitiveData.handles && !hasAuthentication(behavior)) {
        findings.push({
          id: 'SEC001',
          title: 'Missing Authentication',
          severity: 'high',
          category: 'authentication',
          location: behavior.location,
          description:
            `Behavior '${behavior.name.name}' handles sensitive data ` +
            `(${sensitiveData.fields.join(', ')}) but does not require authentication.`,
          recommendation:
            'Add authentication requirement to the security spec or restrict actors.',
          cwe: 'CWE-306',
          owasp: 'A01:2021',
          fix: `security {\n  requires authentication\n}`,
          context: {
            behaviorName: behavior.name.name,
            sensitiveFields: sensitiveData.fields,
          },
        });
      }
    }

    return findings;
  },
};

// ============================================================================
// SEC002: Missing Rate Limiting
// ============================================================================

export const SEC002_MissingRateLimiting: SecurityRule = {
  id: 'SEC002',
  title: 'Missing Rate Limiting',
  description:
    'Public endpoint does not have rate limiting configured. ' +
    'This could lead to denial of service or brute force attacks.',
  severity: 'medium',
  category: 'rate-limiting',
  cwe: 'CWE-770',
  owasp: 'A05:2021',

  check(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { domain } = context;

    for (const behavior of domain.behaviors) {
      if (isPublicBehavior(behavior) && !hasRateLimiting(behavior)) {
        findings.push({
          id: 'SEC002',
          title: 'Missing Rate Limiting',
          severity: 'medium',
          category: 'rate-limiting',
          location: behavior.location,
          description:
            `Behavior '${behavior.name.name}' is publicly accessible but has no rate limiting. ` +
            'This could allow denial of service or brute force attacks.',
          recommendation:
            'Add rate limiting to the security spec. Consider limiting by IP address and/or user.',
          cwe: 'CWE-770',
          owasp: 'A05:2021',
          fix: `security {\n  rate_limit 100 per hour per ip_address\n}`,
          context: {
            behaviorName: behavior.name.name,
            isPublic: true,
          },
        });
      }
    }

    return findings;
  },
};

// ============================================================================
// Export All Auth Rules
// ============================================================================

export const authRules: SecurityRule[] = [
  SEC001_MissingAuthentication,
  SEC002_MissingRateLimiting,
];
