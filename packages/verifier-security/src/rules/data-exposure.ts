// ============================================================================
// Data Exposure Security Rules
// ============================================================================

import type { DomainSecurityRule, SecurityFinding, RuleContext, FieldDefinition } from '../types.js';

/**
 * Check for sensitive data in output
 */
export const sensitiveDataExposureRule: DomainSecurityRule = {
  id: 'SEC020',
  name: 'Sensitive Data Exposure',
  category: 'data-exposure',
  severity: 'high',
  description: 'Sensitive data may be exposed in API responses',
  check: (context: RuleContext): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const { domain } = context;

    const sensitiveFields = [
      'password', 'passwd', 'secret', 'ssn', 'social_security',
      'credit_card', 'card_number', 'cvv', 'pin', 'private_key',
      'api_key', 'token', 'auth_token', 'refresh_token',
    ];

    for (const behavior of domain.behaviors) {
      const output = behavior.output || behavior.outputs;
      if (!output) continue;

      for (const [outputName, outputDef] of Object.entries(output)) {
        const nameLower = outputName.toLowerCase();
        const def = outputDef as FieldDefinition;
        
        if (sensitiveFields.some(sf => nameLower.includes(sf))) {
          findings.push({
            id: 'SEC020',
            category: 'data-exposure',
            severity: 'high',
            title: 'Sensitive Data in Response',
            description: `Output '${outputName}' in '${behavior.name}' appears to contain sensitive data`,
            location: { domain: domain.name, behavior: behavior.name },
            recommendation: 'Remove sensitive data from API responses or mark as encrypted',
            cweId: 'CWE-200',
            owaspId: 'A01:2021',
          });
        }

        // Check for explicitly marked sensitive fields
        if (def.sensitive && !def.encrypted) {
          findings.push({
            id: 'SEC020',
            category: 'data-exposure',
            severity: 'high',
            title: 'Unencrypted Sensitive Data',
            description: `Sensitive field '${outputName}' is not marked as encrypted`,
            location: { domain: domain.name, behavior: behavior.name },
            recommendation: 'Encrypt sensitive data before transmission or exclude from response',
            cweId: 'CWE-311',
            owaspId: 'A02:2021',
          });
        }
      }
    }

    return findings;
  },
};

/**
 * Check for PII exposure
 */
export const piiExposureRule: DomainSecurityRule = {
  id: 'SEC021',
  name: 'PII Data Exposure',
  category: 'data-exposure',
  severity: 'medium',
  description: 'Personally Identifiable Information may be exposed',
  check: (context: RuleContext): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const { domain } = context;

    const piiFields = [
      'email', 'phone', 'address', 'dob', 'date_of_birth', 'birth_date',
      'first_name', 'last_name', 'full_name', 'ip_address', 'location',
      'passport', 'driver_license', 'national_id',
    ];

    for (const behavior of domain.behaviors) {
      const output = behavior.output || behavior.outputs;
      if (!output) continue;

      // Check if behavior returns lists (bulk data)
      const isList = behavior.name.toLowerCase().startsWith('list') ||
                     behavior.name.toLowerCase().includes('getall') ||
                     behavior.name.toLowerCase().includes('search');

      for (const [outputName, outputDef] of Object.entries(output)) {
        const nameLower = outputName.toLowerCase();
        const def = outputDef as FieldDefinition;
        
        if (piiFields.some(pf => nameLower.includes(pf))) {
          // Higher severity for bulk returns
          const severity = isList ? 'high' : 'medium';
          
          findings.push({
            id: 'SEC021',
            category: 'data-exposure',
            severity,
            title: 'PII Exposure Risk',
            description: `PII field '${outputName}' exposed in '${behavior.name}'${isList ? ' (bulk endpoint)' : ''}`,
            location: { domain: domain.name, behavior: behavior.name },
            recommendation: 'Consider masking or redacting PII. For bulk endpoints, implement field-level permissions.',
            cweId: 'CWE-359',
            owaspId: 'A01:2021',
          });
        }

        if (def.pii && isList) {
          findings.push({
            id: 'SEC021',
            category: 'data-exposure',
            severity: 'high',
            title: 'Bulk PII Access',
            description: `PII field '${outputName}' accessible via bulk endpoint '${behavior.name}'`,
            location: { domain: domain.name, behavior: behavior.name },
            recommendation: 'Implement pagination limits and audit logging for bulk PII access',
            cweId: 'CWE-359',
            owaspId: 'A01:2021',
          });
        }
      }
    }

    return findings;
  },
};

/**
 * Check for verbose error information
 */
export const verboseErrorsRule: DomainSecurityRule = {
  id: 'SEC022',
  name: 'Verbose Error Information',
  category: 'data-exposure',
  severity: 'low',
  description: 'Error responses may contain too much information',
  check: (context: RuleContext): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const { domain } = context;

    for (const behavior of domain.behaviors) {
      // Check postconditions for detailed error info
      const postconditions = behavior.postconditions ?? [];
      
      for (const post of postconditions) {
        if (post.includes('stack') || post.includes('trace') || 
            post.includes('internal') || post.includes('debug')) {
          findings.push({
            id: 'SEC022',
            category: 'data-exposure',
            severity: 'low',
            title: 'Verbose Error Details',
            description: `Postcondition in '${behavior.name}' may expose internal details`,
            location: { domain: domain.name, behavior: behavior.name },
            recommendation: 'Avoid exposing stack traces or internal details in error responses',
            cweId: 'CWE-209',
            owaspId: 'A04:2021',
            evidence: post,
          });
        }
      }
    }

    return findings;
  },
};

/**
 * Check for missing data classification
 */
export const missingDataClassificationRule: DomainSecurityRule = {
  id: 'SEC023',
  name: 'Missing Data Classification',
  category: 'data-exposure',
  severity: 'info',
  description: 'Data fields lack sensitivity classification',
  check: (context: RuleContext): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const { domain } = context;

    // Check entities
    for (const entity of domain.entities ?? []) {
      const unclassifiedFields = Object.entries(entity.properties)
        .filter(([_, prop]) => prop.sensitive === undefined && prop.pii === undefined)
        .map(([name]) => name);

      if (unclassifiedFields.length > 0) {
        findings.push({
          id: 'SEC023',
          category: 'data-exposure',
          severity: 'info',
          title: 'Unclassified Data Fields',
          description: `Entity '${entity.name}' has fields without sensitivity classification`,
          location: { domain: domain.name },
          recommendation: 'Add sensitive or pii markers to data fields for proper handling',
          evidence: `Fields: ${unclassifiedFields.join(', ')}`,
        });
      }
    }

    return findings;
  },
};

export const dataExposureRules: DomainSecurityRule[] = [
  sensitiveDataExposureRule,
  piiExposureRule,
  verboseErrorsRule,
  missingDataClassificationRule,
];
