// ============================================================================
// Injection Security Rules
// ============================================================================

import type { DomainSecurityRule, SecurityFinding, RuleContext, FieldDefinition } from '../types.js';

/**
 * Check for SQL injection vulnerabilities
 */
export const sqlInjectionRule: DomainSecurityRule = {
  id: 'SEC010',
  name: 'Potential SQL Injection',
  category: 'injection',
  severity: 'critical',
  description: 'Input used in database operations without proper validation',
  check: (context: RuleContext): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const { domain } = context;

    for (const behavior of domain.behaviors) {
      // Check if behavior deals with database
      if (behavior.name.toLowerCase().includes('query') ||
          behavior.name.toLowerCase().includes('sql') ||
          behavior.name.toLowerCase().includes('database')) {
        
        // Check input for string concatenation patterns
        const input = behavior.input || behavior.inputs;
        if (input) {
          for (const [inputName, inputDef] of Object.entries(input)) {
            const def = inputDef as FieldDefinition;
            if (def.type === 'string' && (!def.validation || def.validation.length === 0)) {
              findings.push({
                id: 'SEC010',
                category: 'injection',
                severity: 'critical',
                title: 'Potential SQL Injection',
                description: `Input '${inputName}' in '${behavior.name}' may be used in database operations without validation`,
                location: { domain: domain.name, behavior: behavior.name },
                recommendation: 'Add input validation constraints and use parameterized queries',
                cweId: 'CWE-89',
                owaspId: 'A03:2021',
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
 * Check for command injection
 */
export const commandInjectionRule: DomainSecurityRule = {
  id: 'SEC011',
  name: 'Potential Command Injection',
  category: 'injection',
  severity: 'critical',
  description: 'User input may be used in system commands',
  check: (context: RuleContext): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const { domain } = context;

    const commandPatterns = [
      'exec', 'execute', 'shell', 'command', 'process', 'spawn', 'system',
    ];

    for (const behavior of domain.behaviors) {
      const behaviorNameLower = behavior.name.toLowerCase();
      
      if (commandPatterns.some(p => behaviorNameLower.includes(p))) {
        const input = behavior.input || behavior.inputs;
        if (input) {
          for (const [inputName, inputDef] of Object.entries(input)) {
            const def = inputDef as FieldDefinition;
            if (def.type === 'string' && (!def.validation || def.validation.length === 0)) {
              findings.push({
                id: 'SEC011',
                category: 'injection',
                severity: 'critical',
                title: 'Potential Command Injection',
                description: `Input '${inputName}' in '${behavior.name}' may be used in system commands`,
                location: { domain: domain.name, behavior: behavior.name },
                recommendation: 'Avoid executing system commands with user input. If necessary, whitelist allowed values.',
                cweId: 'CWE-78',
                owaspId: 'A03:2021',
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
 * Check for XSS vulnerabilities
 */
export const xssRule: DomainSecurityRule = {
  id: 'SEC012',
  name: 'Potential XSS Vulnerability',
  category: 'injection',
  severity: 'high',
  description: 'User input may be rendered without sanitization',
  check: (context: RuleContext): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const { domain } = context;

    for (const behavior of domain.behaviors) {
      // Check if output contains HTML/content type
      const output = behavior.output || behavior.outputs;
      const input = behavior.input || behavior.inputs;
      
      if (output) {
        for (const [outputName, outputDef] of Object.entries(output)) {
          const def = outputDef as FieldDefinition;
          if (def.type === 'string' || def.type?.includes('html')) {
            // Check if corresponding input exists without sanitization
            if (input) {
              for (const [inputName] of Object.entries(input)) {
                // Heuristic: input name similar to output name
                if (inputName.toLowerCase().includes(outputName.toLowerCase()) ||
                    outputName.toLowerCase().includes(inputName.toLowerCase())) {
                  findings.push({
                    id: 'SEC012',
                    category: 'injection',
                    severity: 'high',
                    title: 'Potential XSS Vulnerability',
                    description: `Input '${inputName}' may flow to output '${outputName}' without sanitization`,
                    location: { domain: domain.name, behavior: behavior.name },
                    recommendation: 'Sanitize user input before including in output. Use context-appropriate encoding.',
                    cweId: 'CWE-79',
                    owaspId: 'A03:2021',
                  });
                }
              }
            }
          }
        }
      }
    }

    return findings;
  },
};

/**
 * Check for missing input validation
 */
export const missingValidationRule: DomainSecurityRule = {
  id: 'SEC013',
  name: 'Missing Input Validation',
  category: 'input-validation',
  severity: 'medium',
  description: 'String inputs without validation constraints',
  check: (context: RuleContext): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const { domain } = context;

    for (const behavior of domain.behaviors) {
      const input = behavior.input || behavior.inputs;
      if (!input) continue;

      for (const [inputName, inputDef] of Object.entries(input)) {
        const def = inputDef as FieldDefinition;
        if (def.type === 'string' && 
            (!def.validation || def.validation.length === 0)) {
          findings.push({
            id: 'SEC013',
            category: 'input-validation',
            severity: 'medium',
            title: 'Missing Input Validation',
            description: `String input '${inputName}' in '${behavior.name}' has no validation constraints`,
            location: { domain: domain.name, behavior: behavior.name },
            recommendation: 'Add validation constraints like max_length, pattern, or format',
            cweId: 'CWE-20',
            owaspId: 'A03:2021',
          });
        }
      }
    }

    return findings;
  },
};

/**
 * Check for path traversal
 */
export const pathTraversalRule: DomainSecurityRule = {
  id: 'SEC014',
  name: 'Potential Path Traversal',
  category: 'injection',
  severity: 'high',
  description: 'File path input without proper validation',
  check: (context: RuleContext): SecurityFinding[] => {
    const findings: SecurityFinding[] = [];
    const { domain } = context;

    const filePatterns = ['file', 'path', 'filename', 'directory', 'folder', 'upload', 'download'];

    for (const behavior of domain.behaviors) {
      const input = behavior.input || behavior.inputs;
      if (!input) continue;

      for (const [inputName, inputDef] of Object.entries(input)) {
        const def = inputDef as FieldDefinition;
        const nameLower = inputName.toLowerCase();
        if (filePatterns.some(p => nameLower.includes(p))) {
          if (!def.validation?.some((v: string) => v.includes('pattern'))) {
            findings.push({
              id: 'SEC014',
              category: 'injection',
              severity: 'high',
              title: 'Potential Path Traversal',
              description: `File path input '${inputName}' in '${behavior.name}' may allow path traversal`,
              location: { domain: domain.name, behavior: behavior.name },
              recommendation: 'Validate file paths to prevent traversal (e.g., reject ../, validate against whitelist)',
              cweId: 'CWE-22',
              owaspId: 'A01:2021',
            });
          }
        }
      }
    }

    return findings;
  },
};

export const injectionRules: DomainSecurityRule[] = [
  sqlInjectionRule,
  commandInjectionRule,
  xssRule,
  missingValidationRule,
  pathTraversalRule,
];
