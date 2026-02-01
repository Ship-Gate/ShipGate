// ============================================================================
// Configuration Security Rules
// SEC006: Missing Idempotency
// SEC009: Hardcoded Secrets
// ============================================================================

import {
  SecurityRule,
  Finding,
  RuleContext,
  Behavior,
} from '../severity';

// ============================================================================
// Helper Functions
// ============================================================================

function isStateChangingBehavior(behavior: Behavior): boolean {
  const name = behavior.name.name.toLowerCase();
  
  // Common state-changing patterns
  const stateChangingPatterns = [
    'create',
    'update',
    'delete',
    'remove',
    'add',
    'modify',
    'change',
    'set',
    'register',
    'submit',
    'process',
    'execute',
    'transfer',
    'pay',
    'charge',
    'refund',
    'cancel',
  ];

  return stateChangingPatterns.some((pattern) => name.includes(pattern));
}

function hasIdempotencyKey(behavior: Behavior): boolean {
  // Check input fields for idempotency key
  const hasIdempotencyField = behavior.input.fields.some((f) => {
    const name = f.name.name.toLowerCase();
    return (
      name === 'idempotency_key' ||
      name === 'idempotencykey' ||
      name === 'request_id' ||
      name === 'requestid' ||
      name === 'client_id' ||
      name === 'transaction_id'
    );
  });

  // Check annotations
  const hasIdempotencyAnnotation = behavior.input.fields.some((f) =>
    f.annotations.some((a) => a.name.name.toLowerCase() === 'idempotent')
  );

  return hasIdempotencyField || hasIdempotencyAnnotation;
}

// ============================================================================
// Secret Detection Patterns
// ============================================================================

const SECRET_PATTERNS = [
  {
    name: 'AWS Access Key',
    pattern: /(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/g,
    severity: 'critical' as const,
  },
  {
    name: 'AWS Secret Key',
    pattern: /(?:aws)?_?(?:secret)?_?(?:access)?_?key['"]?\s*[:=]\s*['"][A-Za-z0-9/+=]{40}['"]/gi,
    severity: 'critical' as const,
  },
  {
    name: 'Generic API Key',
    pattern: /(?:api|auth)[-_]?key['"]?\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/gi,
    severity: 'critical' as const,
  },
  {
    name: 'Generic Secret',
    pattern: /(?:secret|password|passwd|pwd|token)['"]?\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    severity: 'critical' as const,
  },
  {
    name: 'Private Key',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    severity: 'critical' as const,
  },
  {
    name: 'GitHub Token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
    severity: 'critical' as const,
  },
  {
    name: 'Slack Token',
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g,
    severity: 'critical' as const,
  },
  {
    name: 'Stripe Key',
    pattern: /(?:sk|pk)_(?:test|live)_[A-Za-z0-9]{24,}/g,
    severity: 'critical' as const,
  },
  {
    name: 'Database URL with Password',
    pattern: /(?:postgres|mysql|mongodb):\/\/[^:]+:[^@]+@/gi,
    severity: 'critical' as const,
  },
  {
    name: 'JWT Token',
    pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
    severity: 'high' as const,
  },
  {
    name: 'Basic Auth Header',
    pattern: /Basic\s+[A-Za-z0-9+/=]{20,}/gi,
    severity: 'high' as const,
  },
  {
    name: 'Bearer Token',
    pattern: /Bearer\s+[A-Za-z0-9_\-.]{20,}/gi,
    severity: 'high' as const,
  },
];

// False positive exclusions
const SECRET_EXCLUSIONS = [
  /['"]?\$\{/,                    // Template variables ${VAR}
  /['"]?process\.env\./,          // Environment variables
  /['"]?os\.environ/,             // Python env
  /['"]?ENV\[/,                   // Ruby env
  /placeholder/i,                 // Placeholder text
  /example/i,                     // Example values
  /your[-_]?/i,                   // Your-api-key patterns
  /xxx+/i,                        // Masked values
  /\*{3,}/,                       // Asterisk masking
  /<[^>]+>/,                      // XML/HTML placeholders
];

function isLikelyFalsePositive(match: string, context: string): boolean {
  const combinedText = `${match} ${context}`.toLowerCase();
  
  return SECRET_EXCLUSIONS.some((exclusion) => exclusion.test(combinedText));
}

// ============================================================================
// SEC006: Missing Idempotency
// ============================================================================

export const SEC006_MissingIdempotency: SecurityRule = {
  id: 'SEC006',
  title: 'Missing Idempotency',
  description:
    'State-changing behavior does not have idempotency key support. ' +
    'This could lead to duplicate operations on network retries.',
  severity: 'medium',
  category: 'configuration',
  cwe: 'CWE-841',
  owasp: 'A04:2021',

  check(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { domain } = context;

    for (const behavior of domain.behaviors) {
      if (isStateChangingBehavior(behavior) && !hasIdempotencyKey(behavior)) {
        findings.push({
          id: 'SEC006',
          title: 'Missing Idempotency',
          severity: 'medium',
          category: 'configuration',
          location: behavior.location,
          description:
            `State-changing behavior '${behavior.name.name}' does not support idempotency keys. ` +
            'Network retries could cause duplicate operations.',
          recommendation:
            'Add an idempotency_key field to the input specification.',
          cwe: 'CWE-841',
          owasp: 'A04:2021',
          fix:
            `input {\n` +
            `  idempotency_key: String? [unique]\n` +
            `  // ... other fields\n` +
            `}`,
          context: {
            behaviorName: behavior.name.name,
          },
        });
      }
    }

    return findings;
  },
};

// ============================================================================
// SEC009: Hardcoded Secrets
// ============================================================================

export const SEC009_HardcodedSecrets: SecurityRule = {
  id: 'SEC009',
  title: 'Hardcoded Secrets',
  description:
    'API keys, passwords, or other secrets appear to be hardcoded in source code. ' +
    'This is a critical security risk as secrets may be exposed in version control.',
  severity: 'critical',
  category: 'secrets',
  cwe: 'CWE-798',
  owasp: 'A07:2021',

  check(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { implementation, options } = context;

    if (!options.scanImplementations || !implementation) {
      return [];
    }

    const lines = implementation.split('\n');
    const language = options.implementationLanguage || 'typescript';
    const fileLocation = language === 'python' ? 'implementation.py' : 'implementation.ts';

    for (const patternDef of SECRET_PATTERNS) {
      let match: RegExpExecArray | null;
      const regex = new RegExp(patternDef.pattern.source, patternDef.pattern.flags);

      while ((match = regex.exec(implementation)) !== null) {
        const beforeMatch = implementation.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;
        const line = lines[lineNumber - 1] || '';
        const contextLines = [
          lines[lineNumber - 2] || '',
          line,
          lines[lineNumber] || '',
        ].join('\n');

        // Skip likely false positives
        if (isLikelyFalsePositive(match[0], contextLines)) {
          continue;
        }

        // Mask the secret for display
        const maskedMatch = maskSecret(match[0]);

        findings.push({
          id: 'SEC009',
          title: 'Hardcoded Secret',
          severity: patternDef.severity,
          category: 'secrets',
          location: {
            file: fileLocation,
            startLine: lineNumber,
            startColumn: match.index - beforeMatch.lastIndexOf('\n'),
          },
          description:
            `Potential ${patternDef.name} detected: ${maskedMatch}`,
          recommendation:
            'Move secrets to environment variables or a secure secrets manager. ' +
            'Never commit secrets to version control.',
          cwe: 'CWE-798',
          owasp: 'A07:2021',
          fix: getSecretsFix(language, patternDef.name),
          context: {
            secretType: patternDef.name,
            masked: maskedMatch,
          },
        });
      }
    }

    return findings;
  },
};

function maskSecret(secret: string): string {
  if (secret.length <= 8) {
    return '*'.repeat(secret.length);
  }
  
  const visibleStart = 4;
  const visibleEnd = 4;
  const masked = secret.substring(0, visibleStart) +
    '*'.repeat(Math.min(secret.length - visibleStart - visibleEnd, 20)) +
    secret.substring(secret.length - visibleEnd);
  
  return masked;
}

function getSecretsFix(language: string, secretType: string): string {
  if (language === 'typescript') {
    return (
      `// Move to environment variable:\n` +
      `const ${secretType.toLowerCase().replace(/\s+/g, '_')} = process.env.${secretType.toUpperCase().replace(/\s+/g, '_')};\n` +
      `\n` +
      `// Or use a secrets manager:\n` +
      `import { getSecret } from '@aws-sdk/client-secrets-manager';\n` +
      `const secret = await getSecret({ SecretId: '${secretType}' });`
    );
  } else {
    return (
      `# Move to environment variable:\n` +
      `import os\n` +
      `${secretType.lower().replace(' ', '_')} = os.environ.get('${secretType.upper().replace(' ', '_')}')\n` +
      `\n` +
      `# Or use a secrets manager:\n` +
      `from aws_secretsmanager import get_secret\n` +
      `secret = get_secret('${secretType}')`
    );
  }
}

// ============================================================================
// Export All Config Rules
// ============================================================================

export const configRules: SecurityRule[] = [
  SEC006_MissingIdempotency,
  SEC009_HardcodedSecrets,
];
