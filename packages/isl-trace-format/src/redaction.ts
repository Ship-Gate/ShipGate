/**
 * Redaction Rules for Trace Events
 * 
 * Ensures no PII (email, password, token, raw headers) appears in trace events.
 * This is critical for security and compliance.
 * 
 * @module @isl-lang/trace-format/redaction
 */

// ============================================================================
// Redaction Constants
// ============================================================================

/**
 * Fields that should ALWAYS be completely redacted (replaced with [REDACTED])
 * These fields contain highly sensitive data that should never appear in traces
 */
const ALWAYS_REDACTED_FIELDS: readonly string[] = [
  // Authentication credentials
  'password',
  'passwd',
  'pwd',
  'pass',
  'plainPassword',
  'passwordHash',
  'hashedPassword',
  'passwordSalt',
  'salt',
  'newPassword',
  'oldPassword',
  'confirmPassword',
  'currentPassword',
  
  // Tokens and secrets
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'idToken',
  'id_token',
  'bearerToken',
  'bearer_token',
  'authToken',
  'auth_token',
  'sessionToken',
  'session_token',
  'csrfToken',
  'csrf_token',
  'xsrfToken',
  'secret',
  'apiSecret',
  'api_secret',
  'clientSecret',
  'client_secret',
  'appSecret',
  'signingKey',
  'encryptionKey',
  'privateKey',
  'private_key',
  'secretKey',
  'secret_key',
  
  // API keys
  'apiKey',
  'api_key',
  'apikey',
  'key',
  'credential',
  'credentials',
  
  // Authorization headers (raw values)
  'authorization',
  'x-auth-token',
  'x-api-key',
  'cookie',
  'setCookie',
  'set-cookie',
];

/**
 * Fields containing PII that should be redacted
 */
const PII_FIELDS: readonly string[] = [
  // Email
  'email',
  'emailAddress',
  'email_address',
  'e-mail',
  'userEmail',
  'user_email',
  
  // Personal identifiers
  'ssn',
  'socialSecurity',
  'social_security',
  'socialSecurityNumber',
  'taxId',
  'tax_id',
  'nationalId',
  'national_id',
  'passport',
  'passportNumber',
  'driverLicense',
  'driver_license',
  'driversLicense',
  'licenseNumber',
  
  // Contact info
  'phone',
  'phoneNumber',
  'phone_number',
  'mobile',
  'mobileNumber',
  'cellphone',
  'telephone',
  'fax',
  
  // Dates
  'dateOfBirth',
  'date_of_birth',
  'dob',
  'birthDate',
  'birthday',
  
  // Financial
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'ccNumber',
  'cvv',
  'cvc',
  'cvv2',
  'securityCode',
  'cardExpiry',
  'expirationDate',
  'bankAccount',
  'bank_account',
  'accountNumber',
  'account_number',
  'routingNumber',
  'routing_number',
  'iban',
  'swift',
  'bic',
  
  // Network identifiers (optional - can be configured)
  'ipAddress',
  'ip_address',
  'clientIp',
  'client_ip',
  'remoteAddr',
  'remote_addr',
  'xForwardedFor',
  'x-forwarded-for',
  'userAgent',
  'user_agent',
];

/**
 * Combined list of all fields to redact
 */
const REDACTED_FIELDS: readonly string[] = [
  ...ALWAYS_REDACTED_FIELDS,
  ...PII_FIELDS,
];

// ============================================================================
// Pattern-Based Redaction Rules
// ============================================================================

/**
 * Pattern definition for string-based redaction
 */
interface RedactionPattern {
  /** Human-readable name */
  name: string;
  /** Regex pattern to match */
  pattern: RegExp;
  /** Replacement string */
  replacement: string;
  /** Priority (higher = processed first) */
  priority: number;
}

/**
 * Comprehensive patterns for detecting and redacting sensitive data in strings
 * Ordered by priority (most specific first)
 */
const REDACTION_PATTERNS: readonly RedactionPattern[] = [
  // JWT tokens (must be before generic base64)
  {
    name: 'jwt',
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    replacement: '[JWT_REDACTED]',
    priority: 100,
  },
  
  // Bearer tokens
  {
    name: 'bearer',
    pattern: /Bearer\s+[A-Za-z0-9_\-./+=]{10,}/gi,
    replacement: '[BEARER_REDACTED]',
    priority: 99,
  },
  
  // Basic auth header
  {
    name: 'basic_auth',
    pattern: /Basic\s+[A-Za-z0-9+/=]{10,}/gi,
    replacement: '[BASIC_AUTH_REDACTED]',
    priority: 98,
  },
  
  // API keys (various formats)
  {
    name: 'stripe_key',
    pattern: /sk[-_](live|test)[-_][A-Za-z0-9]{20,}/g,
    replacement: '[STRIPE_KEY_REDACTED]',
    priority: 95,
  },
  {
    name: 'stripe_pk',
    pattern: /pk[-_](live|test)[-_][A-Za-z0-9]{20,}/g,
    replacement: '[STRIPE_KEY_REDACTED]',
    priority: 95,
  },
  {
    name: 'generic_api_key_sk',
    pattern: /sk[-_][A-Za-z0-9]{20,}/g,
    replacement: '[API_KEY_REDACTED]',
    priority: 90,
  },
  {
    name: 'generic_api_key_pk',
    pattern: /pk[-_][A-Za-z0-9]{20,}/g,
    replacement: '[API_KEY_REDACTED]',
    priority: 90,
  },
  {
    name: 'aws_key',
    pattern: /AKIA[A-Z0-9]{16}/g,
    replacement: '[AWS_KEY_REDACTED]',
    priority: 90,
  },
  {
    name: 'github_token',
    pattern: /gh[ps]_[A-Za-z0-9]{36}/g,
    replacement: '[GITHUB_TOKEN_REDACTED]',
    priority: 90,
  },
  {
    name: 'npm_token',
    pattern: /npm_[A-Za-z0-9]{36}/g,
    replacement: '[NPM_TOKEN_REDACTED]',
    priority: 90,
  },
  
  // Email addresses
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g,
    replacement: '[EMAIL_REDACTED]',
    priority: 80,
  },
  
  // SSN (US format)
  {
    name: 'ssn',
    pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
    replacement: '[SSN_REDACTED]',
    priority: 75,
  },
  
  // Credit card numbers (various formats)
  {
    name: 'credit_card_16',
    pattern: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,
    replacement: '[CARD_REDACTED]',
    priority: 70,
  },
  {
    name: 'credit_card_15',
    pattern: /\b\d{4}[-.\s]?\d{6}[-.\s]?\d{5}\b/g, // AMEX format
    replacement: '[CARD_REDACTED]',
    priority: 70,
  },
  
  // Phone numbers (various formats)
  {
    name: 'phone_intl',
    pattern: /\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
    replacement: '[PHONE_REDACTED]',
    priority: 65,
  },
  {
    name: 'phone_us',
    pattern: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[PHONE_REDACTED]',
    priority: 64,
  },
  
  // IP addresses (IPv4)
  {
    name: 'ipv4',
    pattern: /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    replacement: '[IP_REDACTED]',
    priority: 60,
  },
  
  // IPv6 addresses (simplified pattern)
  {
    name: 'ipv6',
    pattern: /\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b/g,
    replacement: '[IP_REDACTED]',
    priority: 59,
  },
  
  // UUIDs (commonly used for session IDs)
  {
    name: 'uuid_session',
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    replacement: '[UUID_REDACTED]',
    priority: 50,
  },
  
  // Long hex strings (potential tokens, hashes)
  {
    name: 'hex_token',
    pattern: /\b[0-9a-f]{32,}\b/gi,
    replacement: '[TOKEN_REDACTED]',
    priority: 40,
  },
  
  // Base64 strings that look like tokens (long, no spaces)
  {
    name: 'base64_token',
    pattern: /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
    replacement: '[TOKEN_REDACTED]',
    priority: 30,
  },
].sort((a, b) => b.priority - a.priority);

/**
 * Redact sensitive patterns from a string
 */
function redactString(str: string): string {
  let result = str;
  
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    // Reset regex lastIndex to ensure stateless matching
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  
  return result;
}

// ============================================================================
// Object Redaction Logic
// ============================================================================

/**
 * Recursively redact sensitive data from any value
 */
function redact<T>(value: T, fieldsToRedact?: string[]): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return redactString(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map(item => redact(item, fieldsToRedact)) as T;
  }
  if (typeof value === 'object') {
    return redactObject(value as Record<string, unknown>, fieldsToRedact) as T;
  }
  return value;
}

/**
 * Check if a field name matches any redacted field pattern
 * Uses word boundary matching to avoid false positives like "passed" matching "pass"
 */
function shouldRedactField(fieldName: string, additionalFields?: string[]): boolean {
  const lowerFieldName = fieldName.toLowerCase();
  
  // Check additional fields first
  if (additionalFields?.some(f => matchesFieldPattern(lowerFieldName, f.toLowerCase()))) {
    return true;
  }
  
  // Check always-redacted fields
  for (const redactedField of ALWAYS_REDACTED_FIELDS) {
    if (matchesFieldPattern(lowerFieldName, redactedField.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a field name matches PII field patterns
 */
function isPiiField(fieldName: string): boolean {
  const lowerFieldName = fieldName.toLowerCase();
  
  for (const piiField of PII_FIELDS) {
    if (matchesFieldPattern(lowerFieldName, piiField.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

/**
 * Match field name against a pattern with word-boundary semantics
 * - Exact match: "password" === "password"
 * - Prefix match: "passwordHash" starts with "password" (if followed by capital)
 * - Suffix match: "userPassword" ends with "password" (if preceded by capital)
 * - Snake_case: "my_password", "password_hash"
 * 
 * Does NOT match:
 * - "passed" for "pass" (no word boundary - just continuation letters)
 * - "bypass" for "pass" (no word boundary)
 * 
 * Note: This function expects lowercased inputs for consistent matching.
 * Word boundaries are detected via underscores only (camelCase info is lost after lowercasing).
 */
function matchesFieldPattern(fieldName: string, pattern: string): boolean {
  // Exact match
  if (fieldName === pattern) {
    return true;
  }
  
  // Pattern must be a distinct word/segment in the field name
  const patternIndex = fieldName.indexOf(pattern);
  if (patternIndex === -1) {
    return false;
  }
  
  // Check if pattern is at a word boundary
  const charBefore = patternIndex > 0 ? fieldName[patternIndex - 1] : '';
  const charAfter = patternIndex + pattern.length < fieldName.length 
    ? fieldName[patternIndex + pattern.length] 
    : '';
  
  // For lowercased strings, we can only reliably detect:
  // - Start/end of string
  // - Underscore boundaries: my_password, password_hash
  // 
  // We also need to handle camelCase that was lowercased:
  // - "passwordhash" from "passwordHash" - pattern at start, ends at string end or underscore
  // - "mypassword" from "myPassword" - this is tricky, we've lost the boundary info
  //
  // Safe approach: pattern must be at start/end OR bounded by underscores
  // This may miss some camelCase matches but avoids false positives like "passed" matching "pass"
  
  const isStartBoundary = patternIndex === 0 || charBefore === '_';
  const isEndBoundary = patternIndex + pattern.length === fieldName.length || charAfter === '_';
  
  // For strict matching: both boundaries must be valid
  if (isStartBoundary && isEndBoundary) {
    return true;
  }
  
  // Additional heuristic for common patterns:
  // If pattern is at start and followed by common suffixes, allow it
  if (isStartBoundary) {
    const suffix = fieldName.slice(patternIndex + pattern.length);
    const commonSuffixes = ['hash', 'salt', 'token', 'key', 'secret', 'id', 'data', 'value', 'name', 'type', 'at', 'count'];
    for (const commonSuffix of commonSuffixes) {
      if (suffix === commonSuffix || suffix.startsWith(commonSuffix)) {
        return true;
      }
    }
  }
  
  // If pattern is at end and preceded by common prefixes, allow it
  if (isEndBoundary) {
    const prefix = fieldName.slice(0, patternIndex);
    const commonPrefixes = ['new', 'old', 'current', 'confirm', 'hashed', 'plain', 'raw', 'user', 'client', 'api', 'access', 'refresh', 'session', 'auth', 'bearer'];
    for (const commonPrefix of commonPrefixes) {
      if (prefix === commonPrefix || prefix.endsWith(commonPrefix)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Recursively redact sensitive data from an object
 */
function redactObject(
  obj: Record<string, unknown>,
  fieldsToRedact?: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Always redact sensitive fields completely (only string values)
    if (shouldRedactField(key, fieldsToRedact)) {
      // Only redact actual sensitive values, not all values with sensitive names
      if (typeof value === 'string' || typeof value === 'number') {
        result[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        result[key] = '[REDACTED]';
      } else {
        // For booleans, null, undefined - preserve type info
        result[key] = '[REDACTED]';
      }
      continue;
    }
    
    // Redact PII fields (but only string/object values)
    if (isPiiField(key)) {
      if (typeof value === 'string') {
        // For email fields, use pattern redaction first
        const redacted = redactString(value);
        // If pattern didn't catch it but it's an email field, redact it
        if (redacted === value && matchesFieldPattern(key.toLowerCase(), 'email')) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = redacted;
        }
      } else if (typeof value === 'object' && value !== null) {
        result[key] = '[REDACTED]';
      } else {
        // For non-string primitives (numbers, booleans) in PII fields
        // Only redact if it's definitely PII (like phone numbers)
        if (typeof value === 'number' && matchesFieldPattern(key.toLowerCase(), 'phone')) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = value;
        }
      }
      continue;
    }
    
    // Recursively process nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactObject(value as Record<string, unknown>, fieldsToRedact);
    } 
    // Process strings for pattern-based redaction
    else if (typeof value === 'string') {
      result[key] = redactString(value);
    } 
    // Process arrays recursively
    else if (Array.isArray(value)) {
      result[key] = value.map(item => redact(item, fieldsToRedact));
    } 
    // Pass through other values unchanged (booleans, numbers, null, undefined)
    else {
      result[key] = value;
    }
  }
  
  return result;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Redact sensitive data from trace event inputs/outputs
 */
export function redactTraceData<T>(data: T): T {
  return redact(data, [...REDACTED_FIELDS]);
}

/**
 * Configuration options for redaction
 */
export interface RedactionConfig {
  /** Additional fields to redact (beyond defaults) */
  additionalFields?: string[];
  /** Whether to redact UUIDs (default: false in some contexts) */
  redactUuids?: boolean;
  /** Whether to redact IP addresses (default: true) */
  redactIps?: boolean;
  /** Custom patterns to apply */
  customPatterns?: Array<{ pattern: RegExp; replacement: string }>;
}

/**
 * Redact data with custom configuration
 */
export function redactWithConfig<T>(data: T, config: RedactionConfig = {}): T {
  const { additionalFields = [] } = config;
  const allFields = [...REDACTED_FIELDS, ...additionalFields];
  return redact(data, allFields);
}

/**
 * Check if a string contains any sensitive patterns
 * Useful for validation/testing
 */
export function containsSensitiveData(str: string): boolean {
  for (const { pattern } of REDACTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(str)) {
      return true;
    }
  }
  return false;
}

/**
 * Get list of sensitive patterns that match in a string
 * Useful for debugging/testing
 */
export function detectSensitivePatterns(str: string): string[] {
  const matches: string[] = [];
  
  for (const { name, pattern } of REDACTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(str)) {
      matches.push(name);
    }
  }
  
  return matches;
}

/**
 * Partial masking for display purposes (e.g., j***@example.com)
 */
export function partialMaskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return '[INVALID_EMAIL]';
  
  const localPart = email.substring(0, atIndex);
  const domain = email.substring(atIndex);
  
  if (localPart.length <= 2) {
    return `${localPart[0]}***${domain}`;
  }
  
  return `${localPart[0]}${'*'.repeat(Math.min(3, localPart.length - 1))}${domain}`;
}

/**
 * Partial masking for session/token IDs (show first 4 and last 4 chars)
 */
export function partialMaskId(id: string, visibleChars = 4): string {
  if (id.length <= visibleChars * 2) {
    return '[REDACTED]';
  }
  
  const start = id.substring(0, visibleChars);
  const end = id.substring(id.length - visibleChars);
  const middle = '*'.repeat(Math.min(8, id.length - visibleChars * 2));
  
  return `${start}${middle}${end}`;
}

/**
 * Export field lists for external use/testing
 */
export { REDACTED_FIELDS, ALWAYS_REDACTED_FIELDS, PII_FIELDS, REDACTION_PATTERNS };

/**
 * Redact headers object (common in HTTP handlers)
 */
export function redactHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const redacted: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    
    // Always redact common header fields
    if (
      lowerKey === 'authorization' ||
      lowerKey === 'cookie' ||
      lowerKey === 'x-api-key' ||
      lowerKey === 'x-auth-token' ||
      lowerKey.startsWith('x-') && (lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('key'))
    ) {
      redacted[key] = '[REDACTED]';
    } else if (value !== undefined) {
      // Redact PII from header values
      const strValue = Array.isArray(value) ? value.join(', ') : String(value);
      redacted[key] = redactString(strValue);
    }
  }
  
  return redacted;
}

/**
 * Sanitize inputs for trace event
 * This function applies field-name-aware redaction
 */
export function sanitizeInputs(inputs: Record<string, unknown>): Record<string, unknown> {
  // Use redactObject directly to get field-name-aware redaction
  return redactObject(inputs);
}

/**
 * Sanitize outputs for trace event
 * This function applies field-name-aware redaction
 */
export function sanitizeOutputs(outputs: Record<string, unknown>): Record<string, unknown> {
  // Use redactObject directly to get field-name-aware redaction
  return redactObject(outputs);
}

/**
 * Sanitize error object for trace event
 */
export function sanitizeError(error: Error | unknown): {
  name: string;
  message: string;
  code?: string;
  stack?: string;
} {
  if (!(error instanceof Error)) {
    return {
      name: 'UnknownError',
      message: redactString(String(error)),
    };
  }

  return {
    name: error.name,
    message: redactString(error.message),
    code: (error as NodeJS.ErrnoException).code,
    stack: error.stack ? redactString(error.stack) : undefined,
  };
}
