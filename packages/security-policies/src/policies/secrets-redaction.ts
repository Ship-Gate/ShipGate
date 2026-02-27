// ============================================================================
// Policy: Secrets Redaction
// ============================================================================

import type { PolicyRule, Finding, RuleContext, Field, Behavior, ASTFix } from '../types.js';

/**
 * Secret field patterns
 */
const SECRET_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /api[_-]?key/i,
  /apikey/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /bearer/i,
  /auth[_-]?token/i,
  /private[_-]?key/i,
  /encryption[_-]?key/i,
  /signing[_-]?key/i,
  /credential/i,
  /client[_-]?secret/i,
  /webhook[_-]?secret/i,
  /hmac/i,
  /jwt/i,
  /session[_-]?token/i,
  /otp/i,
  /pin/i,
  /cvv/i,
  /cvc/i,
];

/**
 * Secret annotation names
 */
const SECRET_ANNOTATIONS = ['secret', 'sensitive', 'redact', 'masked'];

/**
 * Check if a field contains secrets
 */
function isSecretField(field: Field): boolean {
  // Check by annotation
  const hasSecretAnnotation = field.annotations.some(
    ann => SECRET_ANNOTATIONS.includes(ann.name.name.toLowerCase())
  );
  if (hasSecretAnnotation) return true;

  // Check by name pattern
  const fieldName = field.name.name;
  return SECRET_PATTERNS.some(pattern => pattern.test(fieldName));
}

/**
 * Check if field has proper redaction invariant
 */
function hasRedactionInvariant(field: Field, behavior: Behavior): boolean {
  // Look for never_appears_in invariant
  const invariantStr = behavior.invariants
    .map(inv => JSON.stringify(inv))
    .join(' ');
  
  return invariantStr.includes(field.name.name) && 
         (invariantStr.includes('never_appears_in') || 
          invariantStr.includes('redacted') ||
          invariantStr.includes('masked'));
}

/**
 * Check if field is marked as secret in entity
 */
function isMarkedSecret(field: Field): boolean {
  return field.annotations.some(
    ann => ann.name.name.toLowerCase() === 'secret'
  );
}

/**
 * Generate autofix for adding secret annotation
 */
function generateSecretAnnotationFix(field: Field): ASTFix {
  return {
    description: `Add @secret annotation to field '${field.name.name}'`,
    operation: 'add',
    targetKind: 'Annotation',
    location: field.location,
    patch: {
      position: 'before',
      text: '[secret]',
      insert: {
        kind: 'Annotation',
        name: { kind: 'Identifier', name: 'secret' },
      },
    },
  };
}

/**
 * Generate autofix for adding redaction invariant
 */
function generateRedactionInvariantFix(field: Field, behavior: Behavior): ASTFix {
  return {
    description: `Add redaction invariant for '${field.name.name}'`,
    operation: 'add',
    targetKind: 'Expression',
    location: behavior.location,
    patch: {
      position: 'inside',
      text: `
    invariants {
      input.${field.name.name} never_appears_in logs
      input.${field.name.name} never_appears_in result
    }`,
    },
  };
}

/**
 * Secrets Must Be Annotated Rule
 */
export const secretsAnnotationRule: PolicyRule = {
  id: 'SEC-SECRET-001',
  name: 'Secrets Must Be Annotated',
  category: 'secrets-management',
  severity: 'error',
  description: 'Fields containing secrets must have @secret or @sensitive annotation',
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      for (const field of b.input.fields) {
        if (isSecretField(field) && !isMarkedSecret(field)) {
          findings.push({
            id: 'SEC-SECRET-001',
            category: 'secrets-management',
            severity: 'error',
            title: 'Secret Field Missing Annotation',
            message: `Field '${field.name.name}' in behavior '${b.name.name}' appears to contain secrets but lacks @secret annotation`,
            location: field.location,
            behaviorName: b.name.name,
            fieldName: field.name.name,
            suggestion: `Add [secret] or [sensitive] annotation to field '${field.name.name}'`,
            autofix: generateSecretAnnotationFix(field),
          });
        }
      }
    }

    // Check entity fields
    for (const entity of domain.entities) {
      for (const field of entity.fields) {
        if (isSecretField(field) && !isMarkedSecret(field)) {
          findings.push({
            id: 'SEC-SECRET-001',
            category: 'secrets-management',
            severity: 'error',
            title: 'Secret Entity Field Missing Annotation',
            message: `Entity '${entity.name.name}' field '${field.name.name}' appears to contain secrets but lacks @secret annotation`,
            location: field.location,
            fieldName: `${entity.name.name}.${field.name.name}`,
            suggestion: `Add [secret] annotation to field '${field.name.name}'`,
            autofix: generateSecretAnnotationFix(field),
          });
        }
      }
    }

    return findings;
  },
};

/**
 * Secrets Must Have Redaction Invariants Rule
 */
export const secretsRedactionRule: PolicyRule = {
  id: 'SEC-SECRET-002',
  name: 'Secrets Must Have Redaction Invariants',
  category: 'secrets-management',
  severity: 'error',
  description: 'Secret fields must have never_appears_in invariants for logs and results',
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      for (const field of b.input.fields) {
        if (isSecretField(field) && !hasRedactionInvariant(field, b)) {
          findings.push({
            id: 'SEC-SECRET-002',
            category: 'secrets-management',
            severity: 'error',
            title: 'Secret Missing Redaction Invariant',
            message: `Secret field '${field.name.name}' in behavior '${b.name.name}' lacks never_appears_in invariant`,
            location: field.location,
            behaviorName: b.name.name,
            fieldName: field.name.name,
            suggestion: `Add invariant: input.${field.name.name} never_appears_in logs`,
            autofix: generateRedactionInvariantFix(field, b),
          });
        }
      }
    }

    return findings;
  },
};

/**
 * Secrets Must Not Appear in Output Rule
 */
export const secretsNotInOutputRule: PolicyRule = {
  id: 'SEC-SECRET-003',
  name: 'Secrets Must Not Appear in Output',
  category: 'secrets-management',
  severity: 'error',
  description: 'Secret fields must not be returned in behavior output',
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      // Get secret field names from input
      const secretFields = b.input.fields
        .filter(isSecretField)
        .map(f => f.name.name);

      // Check if output type references any secret fields
      const outputStr = JSON.stringify(b.output);
      for (const secretField of secretFields) {
        if (outputStr.includes(secretField)) {
          findings.push({
            id: 'SEC-SECRET-003',
            category: 'secrets-management',
            severity: 'error',
            title: 'Secret in Output',
            message: `Behavior '${b.name.name}' output may contain secret field '${secretField}'`,
            location: b.output.location,
            behaviorName: b.name.name,
            fieldName: secretField,
            suggestion: `Remove '${secretField}' from output or return only non-secret derived values`,
          });
        }
      }

      // Check postconditions for accidental secret exposure
      for (const post of b.postconditions) {
        const postStr = JSON.stringify(post);
        for (const secretField of secretFields) {
          if (postStr.includes(`result.${secretField}`) || 
              (postStr.includes('result') && postStr.includes(secretField))) {
            findings.push({
              id: 'SEC-SECRET-003',
              category: 'secrets-management',
              severity: 'warning',
              title: 'Secret Reference in Postcondition',
              message: `Postcondition in '${b.name.name}' references secret field '${secretField}' in result`,
              location: post.location,
              behaviorName: b.name.name,
              fieldName: secretField,
              suggestion: `Avoid referencing secret fields in postconditions`,
            });
          }
        }
      }
    }

    return findings;
  },
};

export const secretsManagementPolicies: PolicyRule[] = [
  secretsAnnotationRule,
  secretsRedactionRule,
  secretsNotInOutputRule,
];
