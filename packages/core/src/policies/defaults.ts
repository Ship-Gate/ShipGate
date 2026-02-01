/**
 * Default Policy Definitions
 *
 * Pre-configured policies for common security and compliance requirements.
 */

import type { Policy } from './policyTypes.js';

/**
 * PII (Personally Identifiable Information) policies
 */
export const PII_POLICIES: readonly Policy[] = [
  {
    id: 'PII-001',
    name: 'No PII in Logs',
    description:
      'Prevent personally identifiable information from being written to logs',
    category: 'pii',
    severity: 'error',
    stacks: ['node', 'typescript', 'python', 'go', 'rust', 'java', 'csharp', 'generic'],
    domains: ['healthcare', 'finance', 'ecommerce', 'social', 'enterprise', 'government', 'generic'],
    constraints: [
      {
        id: 'PII-001-A',
        description: 'Email addresses must not appear in log output',
        appliesTo: ['email', 'emailAddress', 'user_email', 'userEmail'],
        pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
        badExample: 'logger.info(`User logged in: ${user.email}`)',
        goodExample: 'logger.info(`User logged in: ${maskEmail(user.email)}`)',
      },
      {
        id: 'PII-001-B',
        description: 'Phone numbers must not appear in log output',
        appliesTo: ['phone', 'phoneNumber', 'mobile', 'telephone'],
        pattern: '\\+?[1-9]\\d{1,14}',
        badExample: 'console.log(`Calling ${customer.phone}`)',
        goodExample: 'console.log(`Calling ${maskPhone(customer.phone)}`)',
      },
      {
        id: 'PII-001-C',
        description: 'Social Security Numbers must never be logged',
        appliesTo: ['ssn', 'socialSecurityNumber', 'social_security'],
        pattern: '\\d{3}-?\\d{2}-?\\d{4}',
        badExample: 'log.debug(`Processing SSN: ${ssn}`)',
        goodExample: 'log.debug(`Processing SSN: ***-**-${ssn.slice(-4)}`)',
      },
    ],
    remediation: {
      action: 'Use masking utilities before logging PII',
      steps: [
        'Import masking utilities from your logging library',
        'Wrap PII fields with appropriate mask function',
        'Consider using structured logging with automatic PII redaction',
      ],
      docUrl: 'https://owasp.org/www-community/controls/Logging_Cheat_Sheet',
    },
    tags: ['pii', 'logging', 'gdpr', 'privacy', 'security'],
    enabledByDefault: true,
    compliance: ['GDPR', 'CCPA', 'HIPAA', 'SOC2'],
  },
  {
    id: 'PII-002',
    name: 'Encrypt PII at Rest',
    description: 'Ensure PII is encrypted when stored in databases or files',
    category: 'pii',
    severity: 'error',
    stacks: ['node', 'typescript', 'python', 'go', 'rust', 'java', 'csharp', 'generic'],
    domains: ['healthcare', 'finance', 'ecommerce', 'enterprise', 'government', 'generic'],
    constraints: [
      {
        id: 'PII-002-A',
        description: 'PII fields must use encrypted storage types',
        appliesTo: ['email', 'ssn', 'phone', 'address', 'dateOfBirth'],
        goodExample: '@Encrypted() email: string',
        badExample: 'email: string // stored in plaintext',
      },
    ],
    remediation: {
      action: 'Use field-level encryption for PII columns',
      steps: [
        'Identify all PII fields in your data model',
        'Apply encryption decorators or use encrypted column types',
        'Implement key rotation strategy',
      ],
    },
    tags: ['pii', 'encryption', 'storage', 'database'],
    enabledByDefault: true,
    compliance: ['GDPR', 'HIPAA', 'PCI-DSS'],
  },
  {
    id: 'PII-003',
    name: 'PII Access Audit Trail',
    description: 'All access to PII must be logged for audit purposes',
    category: 'pii',
    severity: 'warning',
    stacks: ['node', 'typescript', 'python', 'go', 'java', 'generic'],
    domains: ['healthcare', 'finance', 'government', 'enterprise'],
    constraints: [
      {
        id: 'PII-003-A',
        description: 'PII read operations must emit audit events',
        goodExample: 'auditLog.record({ action: "read_pii", userId, targetField })',
      },
    ],
    remediation: {
      action: 'Implement audit logging for PII access',
      steps: [
        'Create an audit service that captures access events',
        'Log who accessed what PII and when',
        'Store audit logs separately from application logs',
      ],
    },
    tags: ['pii', 'audit', 'compliance', 'logging'],
    enabledByDefault: true,
    compliance: ['HIPAA', 'SOC2', 'GDPR'],
  },
];

/**
 * Secrets management policies
 */
export const SECRETS_POLICIES: readonly Policy[] = [
  {
    id: 'SEC-001',
    name: 'No Hardcoded Secrets',
    description: 'Secrets must never be hardcoded in source code',
    category: 'secrets',
    severity: 'error',
    stacks: ['node', 'typescript', 'python', 'go', 'rust', 'java', 'csharp', 'generic'],
    domains: ['healthcare', 'finance', 'ecommerce', 'social', 'enterprise', 'government', 'generic'],
    constraints: [
      {
        id: 'SEC-001-A',
        description: 'API keys must not be hardcoded',
        pattern: '(api[_-]?key|apikey)\\s*[=:]\\s*["\'][a-zA-Z0-9]{16,}["\']',
        badExample: 'const API_KEY = "sk_live_abc123def456"',
        goodExample: 'const API_KEY = process.env.API_KEY',
      },
      {
        id: 'SEC-001-B',
        description: 'Database passwords must not be hardcoded',
        pattern: '(password|passwd|pwd)\\s*[=:]\\s*["\'][^"\']+["\']',
        badExample: 'const dbPassword = "super_secret_123"',
        goodExample: 'const dbPassword = config.get("database.password")',
      },
      {
        id: 'SEC-001-C',
        description: 'Private keys must not be in source',
        pattern: '-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----',
        badExample: 'const privateKey = "-----BEGIN RSA PRIVATE KEY-----\\n..."',
        goodExample: 'const privateKey = await loadKeyFromVault("signing-key")',
      },
      {
        id: 'SEC-001-D',
        description: 'JWT secrets must not be hardcoded',
        pattern: '(jwt[_-]?secret|token[_-]?secret)\\s*[=:]\\s*["\'][^"\']{8,}["\']',
        badExample: 'const JWT_SECRET = "my-super-secret-jwt-key"',
        goodExample: 'const JWT_SECRET = process.env.JWT_SECRET',
      },
    ],
    remediation: {
      action: 'Use environment variables or a secrets manager',
      steps: [
        'Remove hardcoded secrets from source code',
        'Store secrets in environment variables or a vault',
        'Use a secrets manager like HashiCorp Vault, AWS Secrets Manager, or similar',
        'Add secret patterns to .gitignore and pre-commit hooks',
      ],
      docUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
    },
    tags: ['secrets', 'security', 'credentials', 'api-keys'],
    enabledByDefault: true,
    compliance: ['SOC2', 'PCI-DSS', 'ISO27001'],
  },
  {
    id: 'SEC-002',
    name: 'Secrets Rotation',
    description: 'Secrets must have a defined rotation policy',
    category: 'secrets',
    severity: 'warning',
    stacks: ['generic'],
    domains: ['finance', 'healthcare', 'government', 'enterprise'],
    constraints: [
      {
        id: 'SEC-002-A',
        description: 'API keys should have expiration dates',
        goodExample: 'apiKey.expiresAt = Date.now() + 90 * DAY_MS',
      },
      {
        id: 'SEC-002-B',
        description: 'Database credentials should rotate periodically',
        goodExample: 'vault.enableAutoRotation("db-creds", { intervalDays: 30 })',
      },
    ],
    remediation: {
      action: 'Implement automated secret rotation',
      steps: [
        'Define rotation intervals for each secret type',
        'Use a secrets manager with rotation support',
        'Test rotation procedures in non-production environments',
      ],
    },
    tags: ['secrets', 'rotation', 'security', 'operations'],
    enabledByDefault: false,
    compliance: ['SOC2', 'PCI-DSS'],
  },
  {
    id: 'SEC-003',
    name: 'No Secrets in URLs',
    description: 'Secrets must not be passed in URL query parameters',
    category: 'secrets',
    severity: 'error',
    stacks: ['node', 'typescript', 'python', 'go', 'java', 'generic'],
    domains: ['healthcare', 'finance', 'ecommerce', 'social', 'enterprise', 'government', 'generic'],
    constraints: [
      {
        id: 'SEC-003-A',
        description: 'API keys must not appear in URLs',
        pattern: '\\?.*(?:api[_-]?key|token|secret)=[^&]+',
        badExample: 'fetch(`/api/data?api_key=${apiKey}`)',
        goodExample: 'fetch("/api/data", { headers: { Authorization: `Bearer ${token}` } })',
      },
    ],
    remediation: {
      action: 'Pass secrets in headers, not URLs',
      steps: [
        'Move API keys to Authorization header',
        'Use POST body for sensitive data when appropriate',
        'Ensure secrets are never logged as part of URL',
      ],
    },
    tags: ['secrets', 'security', 'http', 'api'],
    enabledByDefault: true,
    compliance: ['OWASP', 'SOC2'],
  },
];

/**
 * Authentication policies
 */
export const AUTH_POLICIES: readonly Policy[] = [
  {
    id: 'AUTH-001',
    name: 'Secure Password Storage',
    description: 'Passwords must be hashed using secure algorithms',
    category: 'auth',
    severity: 'error',
    stacks: ['node', 'typescript', 'python', 'go', 'rust', 'java', 'csharp', 'generic'],
    domains: ['healthcare', 'finance', 'ecommerce', 'social', 'enterprise', 'government', 'generic'],
    constraints: [
      {
        id: 'AUTH-001-A',
        description: 'Use bcrypt, scrypt, or Argon2 for password hashing',
        badExample: 'const hash = md5(password)',
        goodExample: 'const hash = await bcrypt.hash(password, 12)',
      },
      {
        id: 'AUTH-001-B',
        description: 'Never store plaintext passwords',
        badExample: 'user.password = req.body.password',
        goodExample: 'user.passwordHash = await hashPassword(req.body.password)',
      },
    ],
    remediation: {
      action: 'Use a secure password hashing library',
      steps: [
        'Replace any MD5/SHA1 password hashing with bcrypt or Argon2',
        'Use a cost factor of at least 10 for bcrypt',
        'Never store or transmit plaintext passwords',
      ],
      docUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html',
    },
    tags: ['auth', 'passwords', 'security', 'hashing'],
    enabledByDefault: true,
    compliance: ['OWASP', 'SOC2', 'PCI-DSS'],
  },
  {
    id: 'AUTH-002',
    name: 'Session Security',
    description: 'Sessions must be securely managed',
    category: 'auth',
    severity: 'error',
    stacks: ['node', 'typescript', 'python', 'java', 'generic'],
    domains: ['healthcare', 'finance', 'ecommerce', 'social', 'enterprise', 'government', 'generic'],
    constraints: [
      {
        id: 'AUTH-002-A',
        description: 'Session cookies must have Secure and HttpOnly flags',
        badExample: 'res.cookie("session", token)',
        goodExample: 'res.cookie("session", token, { secure: true, httpOnly: true, sameSite: "strict" })',
      },
      {
        id: 'AUTH-002-B',
        description: 'Sessions must expire after inactivity',
        goodExample: 'session.maxAge = 30 * 60 * 1000 // 30 minutes',
      },
      {
        id: 'AUTH-002-C',
        description: 'Regenerate session ID after authentication',
        goodExample: 'req.session.regenerate(() => { /* ... */ })',
      },
    ],
    remediation: {
      action: 'Configure secure session settings',
      steps: [
        'Enable Secure, HttpOnly, and SameSite flags on session cookies',
        'Implement session timeout and renewal',
        'Regenerate session ID on privilege level change',
      ],
    },
    tags: ['auth', 'session', 'cookies', 'security'],
    enabledByDefault: true,
    compliance: ['OWASP', 'SOC2'],
  },
  {
    id: 'AUTH-003',
    name: 'Multi-Factor Authentication',
    description: 'Sensitive operations should require MFA',
    category: 'auth',
    severity: 'warning',
    stacks: ['generic'],
    domains: ['healthcare', 'finance', 'government', 'enterprise'],
    constraints: [
      {
        id: 'AUTH-003-A',
        description: 'Admin actions require MFA verification',
        goodExample: 'if (!user.mfaVerified) throw new MfaRequiredError()',
      },
      {
        id: 'AUTH-003-B',
        description: 'Financial transactions require step-up auth',
        goodExample: 'await requireStepUpAuth(user, "payment")',
      },
    ],
    remediation: {
      action: 'Implement MFA for sensitive operations',
      steps: [
        'Integrate TOTP or WebAuthn for MFA',
        'Identify operations requiring elevated authentication',
        'Implement step-up authentication flow',
      ],
    },
    tags: ['auth', 'mfa', '2fa', 'security'],
    enabledByDefault: false,
    relatedPolicies: ['AUTH-001', 'AUTH-002'],
    compliance: ['SOC2', 'PCI-DSS', 'HIPAA'],
  },
  {
    id: 'AUTH-004',
    name: 'Rate Limiting',
    description: 'Authentication endpoints must be rate limited',
    category: 'auth',
    severity: 'error',
    stacks: ['node', 'typescript', 'python', 'go', 'java', 'generic'],
    domains: ['healthcare', 'finance', 'ecommerce', 'social', 'enterprise', 'government', 'generic'],
    constraints: [
      {
        id: 'AUTH-004-A',
        description: 'Login endpoints must have rate limiting',
        goodExample: 'app.post("/login", rateLimiter({ max: 5, windowMs: 15 * 60 * 1000 }), loginHandler)',
      },
      {
        id: 'AUTH-004-B',
        description: 'Password reset must be rate limited',
        goodExample: 'app.post("/reset-password", rateLimiter({ max: 3, windowMs: 60 * 60 * 1000 }), resetHandler)',
      },
    ],
    remediation: {
      action: 'Add rate limiting to auth endpoints',
      steps: [
        'Install a rate limiting middleware',
        'Configure appropriate limits for login (e.g., 5 attempts per 15 minutes)',
        'Implement account lockout after repeated failures',
      ],
    },
    tags: ['auth', 'rate-limiting', 'security', 'brute-force'],
    enabledByDefault: true,
    compliance: ['OWASP', 'SOC2'],
  },
];

/**
 * Logging policies
 */
export const LOGGING_POLICIES: readonly Policy[] = [
  {
    id: 'LOG-001',
    name: 'Structured Logging',
    description: 'Use structured logging format for machine parseability',
    category: 'logging',
    severity: 'warning',
    stacks: ['node', 'typescript', 'python', 'go', 'java', 'generic'],
    domains: ['healthcare', 'finance', 'ecommerce', 'social', 'enterprise', 'government', 'generic'],
    constraints: [
      {
        id: 'LOG-001-A',
        description: 'Use JSON or structured log format',
        badExample: 'console.log(`User ${userId} performed ${action}`)',
        goodExample: 'logger.info({ userId, action, timestamp: Date.now() })',
      },
    ],
    remediation: {
      action: 'Adopt a structured logging library',
      steps: [
        'Use a logging library like pino, winston, or bunyan',
        'Configure JSON output format',
        'Include correlation IDs in all log entries',
      ],
    },
    tags: ['logging', 'observability', 'structured-data'],
    enabledByDefault: true,
    compliance: ['SOC2'],
  },
  {
    id: 'LOG-002',
    name: 'No Console in Production',
    description: 'Avoid console.log/print statements in production code',
    category: 'logging',
    severity: 'warning',
    stacks: ['node', 'typescript', 'python', 'java', 'generic'],
    domains: ['generic'],
    constraints: [
      {
        id: 'LOG-002-A',
        description: 'Replace console.log with proper logger',
        pattern: 'console\\.(log|info|warn|error|debug)\\(',
        badExample: 'console.log("Processing request...")',
        goodExample: 'logger.info("Processing request...")',
      },
    ],
    remediation: {
      action: 'Replace console statements with a logger',
      steps: [
        'Set up a logging library',
        'Replace all console.* calls with logger methods',
        'Configure log levels per environment',
      ],
    },
    tags: ['logging', 'console', 'production'],
    enabledByDefault: true,
  },
  {
    id: 'LOG-003',
    name: 'Error Context Logging',
    description: 'Errors must be logged with sufficient context',
    category: 'logging',
    severity: 'warning',
    stacks: ['node', 'typescript', 'python', 'go', 'java', 'generic'],
    domains: ['generic'],
    constraints: [
      {
        id: 'LOG-003-A',
        description: 'Include stack trace when logging errors',
        badExample: 'logger.error(err.message)',
        goodExample: 'logger.error({ err, requestId, userId }, "Operation failed")',
      },
      {
        id: 'LOG-003-B',
        description: 'Include correlation ID in error logs',
        goodExample: 'logger.error({ err, correlationId }, "Request failed")',
      },
    ],
    remediation: {
      action: 'Enhance error logging with context',
      steps: [
        'Always log the full error object, not just the message',
        'Include request/correlation ID',
        'Add relevant business context (user ID, operation type)',
      ],
    },
    tags: ['logging', 'errors', 'debugging', 'observability'],
    enabledByDefault: true,
  },
  {
    id: 'LOG-004',
    name: 'Log Retention Policy',
    description: 'Define and enforce log retention periods',
    category: 'logging',
    severity: 'info',
    stacks: ['generic'],
    domains: ['healthcare', 'finance', 'government', 'enterprise'],
    constraints: [
      {
        id: 'LOG-004-A',
        description: 'Audit logs must be retained for compliance period',
        goodExample: 'auditLogRetention: 7 * 365 * DAY // 7 years for SOX',
      },
      {
        id: 'LOG-004-B',
        description: 'Application logs should have defined TTL',
        goodExample: 'appLogRetention: 90 * DAY',
      },
    ],
    remediation: {
      action: 'Configure log retention in your logging infrastructure',
      steps: [
        'Determine retention requirements per compliance framework',
        'Configure log rotation and archival',
        'Implement secure log deletion after retention period',
      ],
    },
    tags: ['logging', 'retention', 'compliance', 'operations'],
    enabledByDefault: false,
    compliance: ['SOX', 'HIPAA', 'GDPR', 'SOC2'],
  },
];

/**
 * All default policies combined
 */
export const ALL_DEFAULT_POLICIES: readonly Policy[] = [
  ...PII_POLICIES,
  ...SECRETS_POLICIES,
  ...AUTH_POLICIES,
  ...LOGGING_POLICIES,
];

/**
 * Policy counts by category
 */
export const POLICY_COUNTS = {
  pii: PII_POLICIES.length,
  secrets: SECRETS_POLICIES.length,
  auth: AUTH_POLICIES.length,
  logging: LOGGING_POLICIES.length,
  total: ALL_DEFAULT_POLICIES.length,
} as const;
