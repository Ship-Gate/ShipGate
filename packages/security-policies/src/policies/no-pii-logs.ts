// ============================================================================
// Policy: No PII in Logs
// ============================================================================

import type { PolicyRule, Finding, RuleContext, Field, Behavior, ASTFix } from '../types.js';

/**
 * PII field patterns
 */
const PII_PATTERNS = [
  /email/i,
  /phone/i,
  /address/i,
  /ssn/i,
  /social.*security/i,
  /passport/i,
  /driver.*license/i,
  /credit.*card/i,
  /card.*number/i,
  /ip.*address/i,
  /ip_address/i,
  /user.*agent/i,
  /location/i,
  /gps/i,
  /latitude/i,
  /longitude/i,
  /birth.*date/i,
  /dob/i,
  /date.*of.*birth/i,
  /national.*id/i,
  /tax.*id/i,
];

/**
 * PII annotation names
 */
const PII_ANNOTATIONS = ['pii', 'sensitive', 'personal'];

/**
 * Check if a field is PII
 */
function isPIIField(field: Field): boolean {
  // Check by annotation
  const hasPIIAnnotation = field.annotations.some(
    ann => PII_ANNOTATIONS.includes(ann.name.name.toLowerCase())
  );
  if (hasPIIAnnotation) return true;

  // Check by name pattern
  const fieldName = field.name.name;
  return PII_PATTERNS.some(pattern => pattern.test(fieldName));
}

/**
 * Check if field is excluded from logs
 */
function isExcludedFromLogs(field: Field, behavior: Behavior): boolean {
  const obs = behavior.observability;
  if (!obs) return false;

  return obs.logs.some(log => 
    log.exclude.some(exc => exc.name === field.name.name)
  );
}

/**
 * Generate autofix for excluding PII from logs
 */
function generateExcludeFromLogsFix(field: Field, behavior: Behavior): ASTFix {
  // If behavior has observability, add to exclude list
  // Otherwise, add observability block with log exclude
  
  if (behavior.observability) {
    return {
      description: `Add '${field.name.name}' to log exclude list`,
      operation: 'modify',
      targetKind: 'ObservabilitySpec',
      location: behavior.observability.location,
      patch: {
        position: 'inside',
        text: `exclude: [${field.name.name}]`,
        insert: {
          kind: 'Identifier',
          name: field.name.name,
        },
      },
    };
  }

  return {
    description: `Add observability block with PII field '${field.name.name}' excluded from logs`,
    operation: 'add',
    targetKind: 'ObservabilitySpec',
    location: behavior.location,
    patch: {
      position: 'inside',
      text: `
    observability {
      logs {
        exclude: [${field.name.name}]
      }
    }`,
    },
  };
}

/**
 * No PII in Logs Policy Rule
 */
export const noPIILogsRule: PolicyRule = {
  id: 'SEC-PII-001',
  name: 'No PII in Logs',
  category: 'pii-protection',
  severity: 'error',
  description: 'PII (Personally Identifiable Information) must not be logged',
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    // Check specific behavior if provided
    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      // Check input fields
      for (const field of b.input.fields) {
        if (isPIIField(field) && !isExcludedFromLogs(field, b)) {
          findings.push({
            id: 'SEC-PII-001',
            category: 'pii-protection',
            severity: 'error',
            title: 'PII Field May Be Logged',
            message: `Input field '${field.name.name}' in behavior '${b.name.name}' appears to contain PII but is not excluded from logs`,
            location: field.location,
            behaviorName: b.name.name,
            fieldName: field.name.name,
            suggestion: `Add '${field.name.name}' to the observability.logs.exclude list or mark with @pii annotation and exclude`,
            autofix: generateExcludeFromLogsFix(field, b),
          });
        }
      }
    }

    // Check entities for PII fields that might be logged
    for (const entity of domain.entities) {
      for (const field of entity.fields) {
        if (isPIIField(field)) {
          // Check if any behavior logs this entity without exclusion
          for (const b of behaviorsToCheck) {
            if (b.observability?.logs.some(log => 
              log.include.some(inc => inc.name === entity.name.name) &&
              !log.exclude.some(exc => exc.name === field.name.name)
            )) {
              findings.push({
                id: 'SEC-PII-001',
                category: 'pii-protection',
                severity: 'error',
                title: 'Entity PII Field May Be Logged',
                message: `Entity '${entity.name.name}' field '${field.name.name}' contains PII and may be logged in behavior '${b.name.name}'`,
                location: field.location,
                behaviorName: b.name.name,
                fieldName: `${entity.name.name}.${field.name.name}`,
                suggestion: `Exclude '${field.name.name}' when logging entity '${entity.name.name}'`,
              });
            }
          }
        }
      }
    }

    return findings;
  },
};

/**
 * Check for PII exposure in postconditions
 */
export const noPIIExposureRule: PolicyRule = {
  id: 'SEC-PII-002',
  name: 'No PII Exposure in Conditions',
  category: 'pii-protection',
  severity: 'warning',
  description: 'PII should not be referenced in preconditions/postconditions that might be logged',
  
  check: (context: RuleContext): Finding[] => {
    const findings: Finding[] = [];
    const { domain, behavior } = context;

    const behaviorsToCheck = behavior ? [behavior] : domain.behaviors;

    for (const b of behaviorsToCheck) {
      // Get all PII field names
      const piiFields = b.input.fields
        .filter(isPIIField)
        .map(f => f.name.name);

      // Check invariants for PII references (these are often logged)
      for (const inv of b.invariants) {
        const invStr = JSON.stringify(inv);
        for (const piiField of piiFields) {
          if (invStr.includes(piiField)) {
            findings.push({
              id: 'SEC-PII-002',
              category: 'pii-protection',
              severity: 'warning',
              title: 'PII in Invariant',
              message: `Invariant in behavior '${b.name.name}' references PII field '${piiField}' which may be exposed in error messages`,
              location: inv.location,
              behaviorName: b.name.name,
              fieldName: piiField,
              suggestion: `Use abstracted checks for PII fields instead of direct references`,
            });
          }
        }
      }
    }

    return findings;
  },
};

export const piiProtectionPolicies: PolicyRule[] = [
  noPIILogsRule,
  noPIIExposureRule,
];
