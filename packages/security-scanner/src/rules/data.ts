// ============================================================================
// Data Exposure Security Rules
// SEC003: Sensitive Data in Logs
// SEC005: Weak Constraints
// SEC007: Unbounded Queries
// ============================================================================

import {
  SecurityRule,
  Finding,
  RuleContext,
  Field,
  Behavior,
  LogSpec,
} from '../severity';

// ============================================================================
// Helper Functions
// ============================================================================

function getSensitiveInputFields(behavior: Behavior): string[] {
  const sensitiveFields: string[] = [];

  for (const field of behavior.input.fields) {
    const isSensitive = field.annotations.some((a) => {
      const name = a.name.name.toLowerCase();
      return ['sensitive', 'secret', 'never_log', 'pii'].includes(name);
    });

    if (isSensitive) {
      sensitiveFields.push(field.name.name);
    }
  }

  return sensitiveFields;
}

function getLogIncludedFields(logs: LogSpec[]): string[] {
  const includedFields: string[] = [];

  for (const log of logs) {
    for (const field of log.include) {
      includedFields.push(field.name);
    }
  }

  return includedFields;
}

function getLogExcludedFields(logs: LogSpec[]): string[] {
  const excludedFields: string[] = [];

  for (const log of logs) {
    for (const field of log.exclude) {
      excludedFields.push(field.name);
    }
  }

  return excludedFields;
}

function isPasswordField(field: Field): boolean {
  const name = field.name.name.toLowerCase();
  return name.includes('password') || name.includes('passwd') || name.includes('pwd');
}

// ============================================================================
// SEC003: Sensitive Data in Logs
// ============================================================================

export const SEC003_SensitiveDataInLogs: SecurityRule = {
  id: 'SEC003',
  title: 'Sensitive Data in Logs',
  description:
    'Field marked as sensitive appears in log specification without being excluded. ' +
    'This could lead to credential leakage in log files.',
  severity: 'high',
  category: 'logging',
  cwe: 'CWE-532',
  owasp: 'A09:2021',

  check(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { domain } = context;

    for (const behavior of domain.behaviors) {
      const sensitiveFields = getSensitiveInputFields(behavior);

      if (sensitiveFields.length === 0) continue;

      if (behavior.observability?.logs) {
        const includedFields = getLogIncludedFields(behavior.observability.logs);
        const excludedFields = getLogExcludedFields(behavior.observability.logs);

        for (const sensitiveField of sensitiveFields) {
          // Check if sensitive field is explicitly included
          if (includedFields.includes(sensitiveField)) {
            findings.push({
              id: 'SEC003',
              title: 'Sensitive Data in Logs',
              severity: 'high',
              category: 'logging',
              location: behavior.observability.logs[0]?.location || behavior.location,
              description:
                `Sensitive field '${sensitiveField}' is explicitly included in log specification ` +
                `for behavior '${behavior.name.name}'.`,
              recommendation:
                'Remove the sensitive field from log includes or add it to excludes.',
              cwe: 'CWE-532',
              owasp: 'A09:2021',
              fix: `logs {\n  exclude: [${sensitiveField}]\n}`,
              context: {
                behaviorName: behavior.name.name,
                sensitiveField,
              },
            });
          }

          // Check if sensitive field is NOT excluded (potential implicit logging)
          if (!excludedFields.includes(sensitiveField) && includedFields.length === 0) {
            // If there are no explicit includes but also no excludes for sensitive fields
            // This might log everything including sensitive data
            findings.push({
              id: 'SEC003',
              title: 'Sensitive Data May Be Logged',
              severity: 'medium',
              category: 'logging',
              location: behavior.location,
              description:
                `Sensitive field '${sensitiveField}' in behavior '${behavior.name.name}' ` +
                'is not explicitly excluded from logs.',
              recommendation:
                'Explicitly exclude sensitive fields from log specification.',
              cwe: 'CWE-532',
              owasp: 'A09:2021',
              fix: `logs {\n  exclude: [${sensitiveField}]\n}`,
              context: {
                behaviorName: behavior.name.name,
                sensitiveField,
              },
            });
          }
        }
      }
    }

    return findings;
  },
};

// ============================================================================
// SEC005: Weak Constraints
// ============================================================================

export const SEC005_WeakConstraints: SecurityRule = {
  id: 'SEC005',
  title: 'Weak Constraints',
  description:
    'Password or security-related field lacks minimum length or complexity constraints. ' +
    'This allows weak passwords that are easily guessed or brute-forced.',
  severity: 'medium',
  category: 'input-validation',
  cwe: 'CWE-521',
  owasp: 'A07:2021',

  check(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { domain } = context;

    // Check type definitions
    for (const typeDef of domain.types) {
      const typeName = typeDef.name.name.toLowerCase();

      if (typeName.includes('password')) {
        const hasMinLength = typeDef.annotations.some((a) => {
          const name = a.name.name.toLowerCase();
          return name === 'min_length' || name === 'minlength';
        });

        if (!hasMinLength) {
          findings.push({
            id: 'SEC005',
            title: 'Weak Password Constraints',
            severity: 'medium',
            category: 'input-validation',
            location: typeDef.location,
            description:
              `Password type '${typeDef.name.name}' does not specify minimum length constraint.`,
            recommendation:
              'Add minimum length constraint (at least 8 characters recommended).',
            cwe: 'CWE-521',
            owasp: 'A07:2021',
            fix: `type ${typeDef.name.name} = String { min_length: 8, max_length: 128 }`,
            context: {
              typeName: typeDef.name.name,
            },
          });
        }
      }
    }

    // Check behavior inputs
    for (const behavior of domain.behaviors) {
      for (const field of behavior.input.fields) {
        if (isPasswordField(field)) {
          const hasMinLength = field.annotations.some((a) => {
            const name = a.name.name.toLowerCase();
            return name === 'min_length' || name === 'minlength';
          });

          if (!hasMinLength) {
            findings.push({
              id: 'SEC005',
              title: 'Weak Password Field Constraints',
              severity: 'medium',
              category: 'input-validation',
              location: field.location,
              description:
                `Password field '${field.name.name}' in behavior '${behavior.name.name}' ` +
                'does not specify minimum length constraint.',
              recommendation:
                'Add minimum length annotation: [min_length: 8]',
              cwe: 'CWE-521',
              owasp: 'A07:2021',
              fix: `${field.name.name}: String [sensitive, min_length: 8]`,
              context: {
                behaviorName: behavior.name.name,
                fieldName: field.name.name,
              },
            });
          }
        }
      }
    }

    return findings;
  },
};

// ============================================================================
// SEC007: Unbounded Queries
// ============================================================================

export const SEC007_UnboundedQueries: SecurityRule = {
  id: 'SEC007',
  title: 'Unbounded Queries',
  description:
    'Behavior returns a list without maximum length constraint. ' +
    'This could lead to resource exhaustion or denial of service.',
  severity: 'low',
  category: 'input-validation',
  cwe: 'CWE-770',
  owasp: 'A05:2021',

  check(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { domain } = context;

    for (const behavior of domain.behaviors) {
      const successType = behavior.output.success;

      if (successType.kind === 'ListType') {
        // Check if there's a limit in input
        const hasLimitInput = behavior.input.fields.some((f) => {
          const name = f.name.name.toLowerCase();
          return name === 'limit' || name === 'page_size' || name === 'max_results';
        });

        // Check if there's a max_length annotation on the output
        const hasMaxLength = false; // Would need to check type constraints

        if (!hasLimitInput && !hasMaxLength) {
          findings.push({
            id: 'SEC007',
            title: 'Unbounded Query Result',
            severity: 'low',
            category: 'input-validation',
            location: behavior.output.location,
            description:
              `Behavior '${behavior.name.name}' returns a list without limit. ` +
              'Large result sets could cause performance issues or resource exhaustion.',
            recommendation:
              'Add a limit parameter to input or max_length constraint to output.',
            cwe: 'CWE-770',
            owasp: 'A05:2021',
            fix:
              `input {\n` +
              `  limit: Int [default: 100, max: 1000]\n` +
              `  offset: Int [default: 0]\n` +
              `}`,
            context: {
              behaviorName: behavior.name.name,
            },
          });
        }
      }
    }

    return findings;
  },
};

// ============================================================================
// Export All Data Rules
// ============================================================================

export const dataRules: SecurityRule[] = [
  SEC003_SensitiveDataInLogs,
  SEC005_WeakConstraints,
  SEC007_UnboundedQueries,
];
