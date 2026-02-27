/**
 * Safe Logging Utilities
 * 
 * Provides PII-safe logging wrappers that automatically redact sensitive data.
 * Use these instead of console.* or raw logger calls.
 * 
 * @module @isl-lang/pipeline/safe-logging
 */

// ============================================================================
// PII PATTERNS FOR DETECTION
// ============================================================================

/**
 * Patterns that identify PII fields by name
 */
const PII_FIELD_PATTERNS: RegExp[] = [
  // Authentication
  /password/i, /passwd/i, /pwd$/i,
  /\btoken\b/i, /accessToken/i, /refreshToken/i, /idToken/i, /bearerToken/i,
  /\bsecret\b/i, /apiSecret/i, /clientSecret/i,
  /credential/i, /apiKey/i, /api_key/i,
  /privateKey/i, /private_key/i,
  /authorization/i,
  
  // Personal
  /email/i, /e-mail/i,
  /\bssn\b/i, /socialSecurity/i, /social_security/i,
  /phone/i, /mobile/i, /cellphone/i,
  /dateOfBirth/i, /date_of_birth/i, /\bdob\b/i,
  /passport/i, /driverLicense/i, /driver_license/i,
  /nationalId/i, /taxId/i,
  
  // Financial
  /creditCard/i, /credit_card/i, /cardNumber/i, /card_number/i,
  /cvv/i, /cvc/i, /securityCode/i,
  /bankAccount/i, /accountNumber/i, /routingNumber/i,
  /iban/i, /swift/i,
  
  // Network
  /ipAddress/i, /ip_address/i, /clientIp/i, /remoteAddr/i,
  /userAgent/i, /user_agent/i,
];

/**
 * Patterns that match actual PII values in strings
 */
const PII_VALUE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Email addresses
  { 
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, 
    replacement: '[EMAIL_REDACTED]' 
  },
  // SSN (US)
  { 
    pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, 
    replacement: '[SSN_REDACTED]' 
  },
  // Phone numbers (include leading + so full match is replaced)
  { 
    pattern: /\+\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\b(1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, 
    replacement: '[PHONE_REDACTED]' 
  },
  // Credit card numbers
  { 
    pattern: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g, 
    replacement: '[CARD_REDACTED]' 
  },
  // IPv4 addresses
  { 
    pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, 
    replacement: '[IP_REDACTED]' 
  },
  // JWT tokens (header.payload.signature)
  { 
    pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, 
    replacement: '[JWT_REDACTED]' 
  },
  // Bearer tokens
  { 
    pattern: /Bearer\s+[A-Za-z0-9_-]+/gi, 
    replacement: '[BEARER_REDACTED]' 
  },
  // API keys (Stripe-style sk_test_/sk_live_ and sk_/pk_ prefix)
  { 
    pattern: /sk_(?:test|live)_[A-Za-z0-9]+|sk[-_][A-Za-z0-9_-]{20,}/g, 
    replacement: '[API_KEY_REDACTED]' 
  },
  { 
    pattern: /pk[-_][A-Za-z0-9_-]{20,}/g, 
    replacement: '[API_KEY_REDACTED]' 
  },
];

// ============================================================================
// REDACTION FUNCTIONS
// ============================================================================

/**
 * Redact PII from any value
 * 
 * @example
 * redact({ email: 'user@example.com', name: 'John' })
 * // => { email: '[REDACTED]', name: 'John' }
 */
export function redact<T>(value: T, fieldsToRedact?: string[]): T {
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
 * Redact PII patterns from a string value
 */
export function redactString(str: string): string {
  let result = str;
  
  for (const { pattern, replacement } of PII_VALUE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  
  return result;
}

/**
 * Redact PII fields from an object
 */
export function redactObject(
  obj: Record<string, unknown>,
  fieldsToRedact?: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Check if this field should be redacted
    const shouldRedact = 
      fieldsToRedact?.some(f => key.toLowerCase().includes(f.toLowerCase())) ||
      PII_FIELD_PATTERNS.some(pattern => pattern.test(key));
    
    if (shouldRedact) {
      if (Array.isArray(value)) {
        result[key] = value.map(item => redact(item, fieldsToRedact));
      } else {
        result[key] = '[REDACTED]';
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactObject(value as Record<string, unknown>, fieldsToRedact);
    } else if (typeof value === 'string') {
      result[key] = redactString(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item => redact(item, fieldsToRedact));
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

// ============================================================================
// MASKING FUNCTIONS
// ============================================================================

const MASK_CHAR = '*';

/**
 * Mask a string, showing only first and last N characters
 */
export function mask(str: string, visibleChars: number = 2): string {
  if (str === undefined || str === null || str.length === 0) return '';
  if (str.length <= visibleChars * 2) return MASK_CHAR.repeat(str.length);
  return str.slice(0, visibleChars) + MASK_CHAR.repeat(str.length - visibleChars * 2) + str.slice(-visibleChars);
}

/**
 * Mask an email address preserving structure
 * @example maskEmail('user@example.com') // => 'u**r@e*****e.com'
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return mask(email);
  
  const maskedLocal = local.length > 2
    ? local[0] + MASK_CHAR.repeat(local.length - 2) + local[local.length - 1]
    : MASK_CHAR.repeat(local.length);
  
  const domainParts = domain.split('.');
  const maskedDomain = domainParts.map((part, i) => {
    if (i === domainParts.length - 1) return part; // Keep TLD
    return part.length > 2
      ? part[0] + MASK_CHAR.repeat(part.length - 2) + part[part.length - 1]
      : MASK_CHAR.repeat(part.length);
  }).join('.');
  
  return `${maskedLocal}@${maskedDomain}`;
}

/**
 * Mask an IP address (middle octets)
 * @example maskIp('192.168.1.100') // => '192.***.***.100'
 */
export function maskIp(ip: string): string {
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${'*'.repeat(3)}.${'*'.repeat(3)}.${parts[3]}`;
    }
  }
  return mask(ip);
}

// ============================================================================
// SAFE ERROR WRAPPER
// ============================================================================

/**
 * Create a safe version of an error for logging
 * Preserves error type and message, but redacts any PII in stack traces
 */
export function safeError(error: Error | unknown): {
  name: string;
  message: string;
  stack?: string;
  code?: string;
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
    stack: error.stack ? redactString(error.stack) : undefined,
    code: (error as NodeJS.ErrnoException).code,
  };
}

// ============================================================================
// SAFE LOGGER WRAPPER
// ============================================================================

export interface SafeLoggerConfig {
  /** Additional fields to always redact */
  redactFields?: string[];
  /** Minimum log level */
  minLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  /** Service name for structured logs */
  service?: string;
}

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  service?: string;
  data?: Record<string, unknown>;
  error?: ReturnType<typeof safeError>;
}

/**
 * Safe Logger that automatically redacts PII
 * 
 * @example
 * const logger = createSafeLogger({ service: 'auth-service' });
 * logger.info('User login', { email: 'user@example.com' });
 * // Logs: { ..., data: { email: '[REDACTED]' } }
 */
export function createSafeLogger(config: SafeLoggerConfig = {}) {
  const { redactFields = [], service = 'app' } = config;

  const formatEntry = (level: string, message: string, data?: Record<string, unknown>, error?: Error): LogEntry => ({
    level,
    message: redactString(message),
    timestamp: new Date().toISOString(),
    service,
    data: data ? redactObject(data, redactFields) : undefined,
    error: error ? safeError(error) : undefined,
  });

  const output = (entry: LogEntry) => {
    const json = JSON.stringify(entry);
    if (typeof process !== 'undefined' && process.stdout?.write) {
      if (entry.level === 'error' || entry.level === 'fatal' || entry.level === 'warn') {
        process.stderr.write(json + '\n');
      } else {
        process.stdout.write(json + '\n');
      }
    }
  };

  return {
    trace: (message: string, data?: Record<string, unknown>) => output(formatEntry('trace', message, data)),
    debug: (message: string, data?: Record<string, unknown>) => output(formatEntry('debug', message, data)),
    info: (message: string, data?: Record<string, unknown>) => output(formatEntry('info', message, data)),
    warn: (message: string, data?: Record<string, unknown>) => output(formatEntry('warn', message, data)),
    error: (message: string, error?: Error, data?: Record<string, unknown>) => output(formatEntry('error', message, data, error)),
    fatal: (message: string, error?: Error, data?: Record<string, unknown>) => output(formatEntry('fatal', message, data, error)),
  };
}

/**
 * Convenience function for quick safe logging
 */
export function safeLog(message: string, data?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level: 'info',
    message: redactString(message),
    timestamp: new Date().toISOString(),
    data: data ? redact(data) : undefined,
  };
  
  if (typeof process !== 'undefined' && process.stdout?.write) {
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  redact,
  redactString,
  redactObject,
  mask,
  maskEmail,
  maskIp,
  safeError,
  createSafeLogger,
  safeLog,
};
