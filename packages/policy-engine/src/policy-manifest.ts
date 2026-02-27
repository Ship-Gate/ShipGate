/**
 * Policy Manifest — Declarative registry of all ShipGate policy rules.
 *
 * Every rule has: id, severity, description, remediation hint, language applicability.
 * Use `getPolicyManifest()` to get the full list for CLI display or documentation.
 */

export type RuleSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface PolicyManifestEntry {
  id: string;
  severity: RuleSeverity;
  description: string;
  remediation: string;
  languages: string[];
  category: string;
  implemented: boolean;
}

const POLICY_RULES: PolicyManifestEntry[] = [
  // ── Auth & Identity ─────────────────────────────────────────────────
  {
    id: 'AUTH_MISSING',
    severity: 'critical',
    description: 'Endpoint accessible without authentication',
    remediation: 'Add authentication middleware or ISL actor constraint `must: authenticated`',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'auth',
    implemented: true,
  },
  {
    id: 'AUTH_JWT_EXPIRY_UNCHECKED',
    severity: 'high',
    description: 'JWT token expiry not validated before granting access',
    remediation: 'Check `exp` claim and reject expired tokens. Use `jsonwebtoken.verify()` with `maxAge`.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'auth',
    implemented: true,
  },
  {
    id: 'AUTH_WEAK_PASSWORD',
    severity: 'high',
    description: 'Password policy does not enforce sufficient complexity',
    remediation: 'Require min 8 chars, mixed case, number, and special character',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'auth',
    implemented: true,
  },
  {
    id: 'AUTH_BROKEN_ACCESS_CONTROL',
    severity: 'critical',
    description: 'Resource accessible by unauthorized roles',
    remediation: 'Add role-based access control checks matching ISL actor constraints',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'auth',
    implemented: true,
  },
  // ── Secrets ─────────────────────────────────────────────────────────
  {
    id: 'SECRET_HARDCODED',
    severity: 'critical',
    description: 'Secret or API key hardcoded in source code',
    remediation: 'Move to environment variable. Reference via ISL config block.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'secrets',
    implemented: true,
  },
  {
    id: 'SECRET_LOGGED',
    severity: 'high',
    description: 'Secret value written to logs or console',
    remediation: 'Redact sensitive fields before logging. Use structured logging.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'secrets',
    implemented: true,
  },
  {
    id: 'SECRET_IN_URL',
    severity: 'high',
    description: 'Secret or token passed as URL query parameter',
    remediation: 'Use Authorization header or request body for sensitive values',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'secrets',
    implemented: true,
  },
  // ── PII ─────────────────────────────────────────────────────────────
  {
    id: 'PII_UNENCRYPTED',
    severity: 'high',
    description: 'Personally identifiable information stored without encryption',
    remediation: 'Encrypt PII at rest. Use field-level encryption for sensitive columns.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'pii',
    implemented: true,
  },
  {
    id: 'PII_OVER_EXPOSED',
    severity: 'medium',
    description: 'API response includes PII fields not required by the consumer',
    remediation: 'Use ISL views to expose only necessary fields. Apply response filtering.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'pii',
    implemented: true,
  },
  {
    id: 'PII_NO_RETENTION',
    severity: 'medium',
    description: 'No data retention policy for PII fields',
    remediation: 'Define retention period in ISL entity annotations. Implement cleanup job.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'pii',
    implemented: true,
  },
  // ── Ghost Routes / Env ──────────────────────────────────────────────
  {
    id: 'GHOST_ROUTE',
    severity: 'high',
    description: 'Route referenced in code but not declared in ISL API spec',
    remediation: 'Add the route to the ISL api block, or remove the orphaned handler.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'truthpack',
    implemented: true,
  },
  {
    id: 'GHOST_ENV',
    severity: 'high',
    description: 'Environment variable accessed but not declared in ISL config or Truthpack',
    remediation: 'Add to ISL config block or .env.example. Register in Truthpack.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'truthpack',
    implemented: true,
  },
  {
    id: 'GHOST_IMPORT',
    severity: 'medium',
    description: 'Import references a module not in package.json or workspace',
    remediation: 'Install the dependency or remove the import.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'truthpack',
    implemented: true,
  },
  // ── Rate Limiting ───────────────────────────────────────────────────
  {
    id: 'RATE_LIMIT_MISSING',
    severity: 'high',
    description: 'Public endpoint has no rate limiting configured',
    remediation: 'Add rate limiting middleware. Define limits in ISL security spec.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'rate-limit',
    implemented: true,
  },
  {
    id: 'RATE_LIMIT_TOO_HIGH',
    severity: 'medium',
    description: 'Rate limit threshold is unreasonably high (>10k req/min)',
    remediation: 'Review and lower rate limits to match expected traffic patterns.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'rate-limit',
    implemented: true,
  },
  // ── CORS ────────────────────────────────────────────────────────────
  {
    id: 'CORS_WILDCARD',
    severity: 'high',
    description: 'CORS allows all origins (Access-Control-Allow-Origin: *)',
    remediation: 'Restrict CORS to specific trusted origins.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'cors',
    implemented: true,
  },
  {
    id: 'CORS_CREDENTIALS_WILDCARD',
    severity: 'critical',
    description: 'CORS allows credentials with wildcard origin',
    remediation: 'Never combine credentials:true with origin:*. Specify exact origins.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'cors',
    implemented: true,
  },
  // ── Validation ──────────────────────────────────────────────────────
  {
    id: 'INPUT_UNVALIDATED',
    severity: 'high',
    description: 'Request input not validated against schema before processing',
    remediation: 'Add Zod/Pydantic validation matching ISL preconditions.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'validation',
    implemented: true,
  },
  {
    id: 'UNVALIDATED_REDIRECT',
    severity: 'high',
    description: 'HTTP redirect target not validated (open redirect vulnerability)',
    remediation: 'Validate redirect URLs against an allowlist of trusted domains.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'validation',
    implemented: true,
  },
  {
    id: 'MASS_ASSIGNMENT',
    severity: 'high',
    description: 'Object properties directly assigned from user input without filtering',
    remediation: 'Use explicit field picking (ISL input spec) instead of spreading request body.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'validation',
    implemented: true,
  },
  {
    id: 'SQL_INJECTION',
    severity: 'critical',
    description: 'Raw SQL query constructed from user input',
    remediation: 'Use parameterized queries or an ORM (Prisma, SQLAlchemy).',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'validation',
    implemented: true,
  },
  // ── Error Handling ──────────────────────────────────────────────────
  {
    id: 'ERROR_UNHANDLED',
    severity: 'medium',
    description: 'Behavior does not handle all ISL-declared error cases',
    remediation: 'Add error handlers for each error defined in the ISL errors block.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'errors',
    implemented: true,
  },
  {
    id: 'ERROR_STACK_LEAKED',
    severity: 'high',
    description: 'Internal error stack trace exposed in API response',
    remediation: 'Return generic error messages in production. Log full details server-side.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'errors',
    implemented: true,
  },
  // ── Contract Compliance ─────────────────────────────────────────────
  {
    id: 'PRECONDITION_MISSING',
    severity: 'medium',
    description: 'ISL precondition has no corresponding runtime check',
    remediation: 'Add validation logic that enforces the ISL precondition.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'contract',
    implemented: true,
  },
  {
    id: 'POSTCONDITION_MISSING',
    severity: 'medium',
    description: 'ISL postcondition not verified after behavior execution',
    remediation: 'Add assertion or validation after the behavior completes.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'contract',
    implemented: true,
  },
  {
    id: 'INVARIANT_VIOLATED',
    severity: 'high',
    description: 'Entity invariant can be violated by current implementation',
    remediation: 'Add runtime invariant checks in entity creation/update paths.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'contract',
    implemented: true,
  },
  {
    id: 'SPEC_DRIFT',
    severity: 'medium',
    description: 'Implementation has drifted from the ISL specification',
    remediation: 'Run `shipgate verify` and fix violations, or update the spec.',
    languages: ['typescript', 'python', 'go', 'rust'],
    category: 'contract',
    implemented: true,
  },
];

/**
 * Get the full policy manifest (all 27 rules).
 */
export function getPolicyManifest(): PolicyManifestEntry[] {
  return [...POLICY_RULES];
}

/**
 * Get rules filtered by category.
 */
export function getRulesByCategory(category: string): PolicyManifestEntry[] {
  return POLICY_RULES.filter(r => r.category === category);
}

/**
 * Get all unique categories.
 */
export function getCategories(): string[] {
  return [...new Set(POLICY_RULES.map(r => r.category))];
}

/**
 * Get the manifest as a JSON-serializable object.
 */
export function getPolicyManifestJSON(): object {
  return {
    version: '1.0.0',
    totalRules: POLICY_RULES.length,
    categories: getCategories(),
    rules: POLICY_RULES,
  };
}
