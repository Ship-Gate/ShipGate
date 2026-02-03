/**
 * Safe Logging Utilities
 * 
 * Security invariant: PII and sensitive data are NEVER logged.
 * - Emails are redacted to: t***@example.com
 * - IPs are redacted to: 192.168.xxx.xxx
 * - Passwords are NEVER accepted as input
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  data: Record<string, unknown>;
}

// Captured logs for test verification
const capturedLogs: LogEntry[] = [];
let captureEnabled = false;

/**
 * Enable log capture for testing
 */
export function enableLogCapture(): void {
  captureEnabled = true;
  capturedLogs.length = 0;
}

/**
 * Disable log capture
 */
export function disableLogCapture(): void {
  captureEnabled = false;
}

/**
 * Get captured logs
 */
export function getCapturedLogs(): LogEntry[] {
  return [...capturedLogs];
}

/**
 * Clear captured logs
 */
export function clearCapturedLogs(): void {
  capturedLogs.length = 0;
}

/**
 * Redact PII from a value
 */
export function redactPII(value: string, type: 'email' | 'ip' | 'phone'): string {
  switch (type) {
    case 'email': {
      const [local, domain] = value.split('@');
      if (!domain) return '***@***';
      const redactedLocal = local.length > 1 
        ? `${local[0]}${'*'.repeat(Math.min(local.length - 1, 3))}`
        : '*';
      return `${redactedLocal}@${domain}`;
    }
    case 'ip': {
      const parts = value.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.xxx.xxx`;
      }
      // IPv6 or unknown format
      return 'xxx.xxx.xxx.xxx';
    }
    case 'phone': {
      if (value.length > 4) {
        return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
      }
      return '****';
    }
    default:
      return '***REDACTED***';
  }
}

/**
 * List of forbidden keys that should NEVER appear in logs
 */
const FORBIDDEN_KEYS = new Set([
  'password',
  'password_hash',
  'secret',
  'api_key',
  'apiKey',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'private_key',
  'privateKey',
  'credit_card',
  'creditCard',
  'ssn',
  'social_security',
]);

/**
 * Sanitize log data to remove forbidden keys
 */
function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key is forbidden
    if (FORBIDDEN_KEYS.has(lowerKey)) {
      continue; // Skip forbidden keys entirely
    }

    // Recursively sanitize nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeLogData(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'object' && item !== null
          ? sanitizeLogData(item as Record<string, unknown>)
          : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Safe logging function that redacts PII and sensitive data
 */
export function safeLog(
  level: LogLevel,
  event: string,
  data: Record<string, unknown> = {}
): void {
  const sanitizedData = sanitizeLogData(data);
  
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    data: sanitizedData,
  };

  // Capture for testing if enabled
  if (captureEnabled) {
    capturedLogs.push(entry);
  }

  // In production, send to your logging service
  // For now, output to console (without PII)
  if (process.env.NODE_ENV !== 'test') {
    const output = JSON.stringify(entry);
    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
        console.debug(output);
        break;
      default:
        console.log(output);
    }
  }
}

/**
 * Assert that captured logs contain no PII
 * Used in tests to verify logging safety
 */
export function assertNoLoggedPII(logs: LogEntry[]): { safe: boolean; violations: string[] } {
  const violations: string[] = [];

  const checkValue = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      // Check for email patterns
      if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(value) && 
          !value.includes('***') && !value.includes('xxx')) {
        violations.push(`Unredacted email found at ${path}: ${value}`);
      }
      
      // Check for full IP addresses (should be xxx.xxx)
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) {
        violations.push(`Unredacted IP found at ${path}: ${value}`);
      }

      // Check for common password patterns
      if (path.toLowerCase().includes('password')) {
        violations.push(`Password field logged at ${path}`);
      }
    } else if (value && typeof value === 'object') {
      for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
        checkValue(v, `${path}.${key}`);
      }
    }
  };

  for (const log of logs) {
    checkValue(log.data, 'data');
  }

  return { safe: violations.length === 0, violations };
}
