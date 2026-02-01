// ============================================================================
// Cryptography Security Rules
// SEC004: Missing Encryption
// SEC010: Insecure Randomness
// ============================================================================

import {
  SecurityRule,
  Finding,
  RuleContext,
  Field,
  Entity,
} from '../severity';

// ============================================================================
// Pattern Definitions
// ============================================================================

const WEAK_CRYPTO_ALGORITHMS = [
  'md5',
  'sha1',
  'des',
  '3des',
  'rc4',
  'rc2',
  'blowfish',
];

const INSECURE_RANDOM_PATTERNS = [
  {
    pattern: /Math\.random\s*\(/g,
    name: 'Math.random()',
    language: 'typescript',
  },
  {
    pattern: /random\.random\s*\(/g,
    name: 'random.random()',
    language: 'python',
  },
  {
    pattern: /random\.randint\s*\(/g,
    name: 'random.randint()',
    language: 'python',
  },
  {
    pattern: /random\.choice\s*\(/g,
    name: 'random.choice()',
    language: 'python',
  },
];

const SECURE_RANDOM_ALTERNATIVES = {
  typescript: 'crypto.randomBytes() or crypto.randomUUID()',
  python: 'secrets.token_bytes() or secrets.token_hex()',
};

const WEAK_CRYPTO_PATTERNS = [
  {
    pattern: /createHash\s*\(\s*["']md5["']\s*\)/gi,
    name: 'MD5 hash',
    cwe: 'CWE-328',
  },
  {
    pattern: /createHash\s*\(\s*["']sha1["']\s*\)/gi,
    name: 'SHA-1 hash',
    cwe: 'CWE-328',
  },
  {
    pattern: /hashlib\.md5\s*\(/gi,
    name: 'MD5 hash (Python)',
    cwe: 'CWE-328',
  },
  {
    pattern: /hashlib\.sha1\s*\(/gi,
    name: 'SHA-1 hash (Python)',
    cwe: 'CWE-328',
  },
  {
    pattern: /DES|3DES|RC4|RC2/gi,
    name: 'Weak encryption algorithm',
    cwe: 'CWE-327',
  },
];

const HARDCODED_IV_PATTERNS = [
  {
    pattern: /iv\s*[:=]\s*["'][a-zA-Z0-9+/=]+["']/gi,
    name: 'Hardcoded IV',
    cwe: 'CWE-329',
  },
  {
    pattern: /initialization_vector\s*[:=]\s*["'][a-zA-Z0-9+/=]+["']/gi,
    name: 'Hardcoded initialization vector',
    cwe: 'CWE-329',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

const PII_FIELD_PATTERNS = [
  'email',
  'phone',
  'address',
  'ssn',
  'social_security',
  'credit_card',
  'bank_account',
  'passport',
  'driver_license',
  'date_of_birth',
  'medical',
  'health',
  'salary',
  'income',
];

function isPIIField(field: Field): boolean {
  const fieldName = field.name.name.toLowerCase();
  return (
    field.annotations.some((a) => 
      ['pii', 'sensitive', 'encrypted'].includes(a.name.name.toLowerCase())
    ) ||
    PII_FIELD_PATTERNS.some((pattern) => fieldName.includes(pattern))
  );
}

function hasEncryptionAnnotation(field: Field): boolean {
  return field.annotations.some((a) => {
    const name = a.name.name.toLowerCase();
    return name === 'encrypted' || name === 'encrypt';
  });
}

function hasSecretAnnotation(field: Field): boolean {
  return field.annotations.some((a) => {
    const name = a.name.name.toLowerCase();
    return name === 'secret' || name === 'sensitive' || name === 'never_log';
  });
}

// ============================================================================
// SEC004: Missing Encryption
// ============================================================================

export const SEC004_MissingEncryption: SecurityRule = {
  id: 'SEC004',
  title: 'Missing Encryption',
  description:
    'PII or sensitive field is stored without encryption requirement. ' +
    'This could lead to data exposure if the database is compromised.',
  severity: 'high',
  category: 'cryptography',
  cwe: 'CWE-311',
  owasp: 'A02:2021',

  check(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { domain } = context;

    for (const entity of domain.entities) {
      for (const field of entity.fields) {
        if (isPIIField(field) && !hasEncryptionAnnotation(field)) {
          // Check if it's a hash field (like password_hash) - those are okay
          const fieldName = field.name.name.toLowerCase();
          if (fieldName.includes('hash') || fieldName.includes('hashed')) {
            continue;
          }

          findings.push({
            id: 'SEC004',
            title: 'Missing Encryption',
            severity: 'high',
            category: 'cryptography',
            location: field.location,
            description:
              `Field '${entity.name.name}.${field.name.name}' appears to contain PII ` +
              'but does not have an encryption requirement.',
            recommendation:
              'Add [encrypted] annotation to ensure the field is encrypted at rest.',
            cwe: 'CWE-311',
            owasp: 'A02:2021',
            fix: `${field.name.name}: ${field.type.kind} [encrypted]`,
            context: {
              entityName: entity.name.name,
              fieldName: field.name.name,
            },
          });
        }
      }
    }

    return findings;
  },
};

// ============================================================================
// SEC010: Insecure Randomness
// ============================================================================

export const SEC010_InsecureRandomness: SecurityRule = {
  id: 'SEC010',
  title: 'Insecure Randomness',
  description:
    'Non-cryptographic random number generator used for security-sensitive operations. ' +
    'This could lead to predictable tokens, keys, or identifiers.',
  severity: 'high',
  category: 'cryptography',
  cwe: 'CWE-330',
  owasp: 'A02:2021',

  check(context: RuleContext): Finding[] {
    const findings: Finding[] = [];
    const { implementation, options } = context;

    if (!options.scanImplementations || !implementation) {
      return [];
    }

    const language = options.implementationLanguage || 'typescript';
    const lines = implementation.split('\n');

    for (const patternDef of INSECURE_RANDOM_PATTERNS) {
      if (patternDef.language !== language) continue;

      let match: RegExpExecArray | null;
      const regex = new RegExp(patternDef.pattern.source, patternDef.pattern.flags);

      while ((match = regex.exec(implementation)) !== null) {
        const beforeMatch = implementation.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;
        const line = lines[lineNumber - 1] || '';

        // Check if it's in a security context
        const securityContext = isSecurityContext(line, lines, lineNumber);

        if (securityContext.isSecurityRelated) {
          findings.push({
            id: 'SEC010',
            title: 'Insecure Randomness',
            severity: 'high',
            category: 'cryptography',
            location: {
              file: language === 'python' ? 'implementation.py' : 'implementation.ts',
              startLine: lineNumber,
              startColumn: match.index - beforeMatch.lastIndexOf('\n'),
            },
            description:
              `${patternDef.name} used in security context: ${securityContext.context}. ` +
              'This provides predictable values unsuitable for security purposes.',
            recommendation:
              `Use cryptographically secure random: ${SECURE_RANDOM_ALTERNATIVES[language]}`,
            cwe: 'CWE-330',
            owasp: 'A02:2021',
            fix: getSecureRandomFix(language, patternDef.name),
            context: {
              pattern: patternDef.name,
              securityContext: securityContext.context,
            },
          });
        }
      }
    }

    // Also check for weak crypto algorithms
    for (const patternDef of WEAK_CRYPTO_PATTERNS) {
      let match: RegExpExecArray | null;
      const regex = new RegExp(patternDef.pattern.source, patternDef.pattern.flags);

      while ((match = regex.exec(implementation)) !== null) {
        const beforeMatch = implementation.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;

        findings.push({
          id: 'SEC010',
          title: 'Weak Cryptographic Algorithm',
          severity: 'high',
          category: 'cryptography',
          location: {
            file: language === 'python' ? 'implementation.py' : 'implementation.ts',
            startLine: lineNumber,
          },
          description:
            `${patternDef.name} is cryptographically weak and should not be used.`,
          recommendation:
            'Use SHA-256 or stronger for hashing, AES-256-GCM for encryption.',
          cwe: patternDef.cwe,
          owasp: 'A02:2021',
          context: {
            algorithm: patternDef.name,
          },
        });
      }
    }

    return findings;
  },
};

function isSecurityContext(
  line: string,
  lines: string[],
  lineNumber: number
): { isSecurityRelated: boolean; context: string } {
  const context = [
    lines[lineNumber - 3] || '',
    lines[lineNumber - 2] || '',
    line,
    lines[lineNumber] || '',
    lines[lineNumber + 1] || '',
  ].join('\n').toLowerCase();

  const securityKeywords = [
    { keyword: 'token', context: 'token generation' },
    { keyword: 'session', context: 'session management' },
    { keyword: 'password', context: 'password handling' },
    { keyword: 'secret', context: 'secret generation' },
    { keyword: 'key', context: 'key generation' },
    { keyword: 'auth', context: 'authentication' },
    { keyword: 'encrypt', context: 'encryption' },
    { keyword: 'salt', context: 'password salting' },
    { keyword: 'nonce', context: 'nonce generation' },
    { keyword: 'iv', context: 'initialization vector' },
    { keyword: 'otp', context: 'one-time password' },
    { keyword: 'verification', context: 'verification code' },
    { keyword: 'reset', context: 'password reset' },
  ];

  for (const { keyword, context: ctx } of securityKeywords) {
    if (context.includes(keyword)) {
      return { isSecurityRelated: true, context: ctx };
    }
  }

  return { isSecurityRelated: false, context: '' };
}

function getSecureRandomFix(language: string, pattern: string): string {
  if (language === 'typescript') {
    return (
      `// Replace ${pattern} with crypto:\n` +
      `import { randomBytes, randomUUID } from 'crypto';\n` +
      `const token = randomBytes(32).toString('hex');\n` +
      `const id = randomUUID();`
    );
  } else {
    return (
      `# Replace ${pattern} with secrets:\n` +
      `import secrets\n` +
      `token = secrets.token_hex(32)\n` +
      `otp = secrets.token_urlsafe(16)`
    );
  }
}

// ============================================================================
// Export All Crypto Rules
// ============================================================================

export const cryptoRules: SecurityRule[] = [
  SEC004_MissingEncryption,
  SEC010_InsecureRandomness,
];
