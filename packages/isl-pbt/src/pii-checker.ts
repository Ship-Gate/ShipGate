// ============================================================================
// PII Checker - Detect sensitive data leaks in logs
// ============================================================================

import type { LogCapture, PIIConfig, BehaviorProperties } from './types.js';
import { DEFAULT_PII_CONFIG } from './types.js';
import { getNeverLoggedFields } from './property.js';

// ============================================================================
// PII DETECTION
// ============================================================================

/**
 * Result of PII check
 */
export interface PIICheckResult {
  /** Whether any PII was found */
  hasPII: boolean;
  
  /** Violations found */
  violations: PIIViolation[];
}

/**
 * A single PII violation
 */
export interface PIIViolation {
  /** The field that was leaked */
  field: string;
  
  /** The log entry where it was found */
  log: LogCapture;
  
  /** Where in the log it was found */
  location: 'message' | 'args';
  
  /** The leaked value (redacted for reporting) */
  leakedValue: string;
}

/**
 * Check logs for PII based on behavior invariants
 */
export function checkLogsForPII(
  logs: LogCapture[],
  input: Record<string, unknown>,
  properties: BehaviorProperties,
  config: PIIConfig = DEFAULT_PII_CONFIG
): PIICheckResult {
  const violations: PIIViolation[] = [];
  
  // Get fields that should never be logged from invariants
  const neverLoggedFields = getNeverLoggedFields(properties);
  
  // Also include config-specified forbidden fields
  const allForbiddenFields = new Set([
    ...neverLoggedFields,
    ...config.forbiddenFields,
  ]);
  
  for (const log of logs) {
    // Check each forbidden field
    for (const field of allForbiddenFields) {
      const value = input[field];
      if (value === undefined || value === null) continue;
      
      const valueStr = String(value);
      
      // Check message
      if (log.message.includes(valueStr)) {
        violations.push({
          field,
          log,
          location: 'message',
          leakedValue: redactValue(valueStr),
        });
      }
      
      // Check args
      for (const arg of log.args) {
        if (containsValue(arg, valueStr)) {
          violations.push({
            field,
            log,
            location: 'args',
            leakedValue: redactValue(valueStr),
          });
          break;
        }
      }
    }
    
    // Check for pattern matches (e.g., unredacted emails)
    for (const pattern of config.patterns) {
      const matches = log.message.match(pattern.pattern);
      if (matches) {
        // Check if the match is one of our input values
        for (const [field, value] of Object.entries(input)) {
          if (matches.some((m) => m === String(value))) {
            violations.push({
              field,
              log,
              location: 'message',
              leakedValue: redactValue(String(value)),
            });
          }
        }
      }
    }
  }
  
  return {
    hasPII: violations.length > 0,
    violations,
  };
}

/**
 * Check if a value contains a specific string
 */
function containsValue(container: unknown, value: string): boolean {
  if (container === null || container === undefined) {
    return false;
  }
  
  if (typeof container === 'string') {
    return container.includes(value);
  }
  
  if (typeof container === 'number' || typeof container === 'boolean') {
    return String(container).includes(value);
  }
  
  if (Array.isArray(container)) {
    return container.some((item) => containsValue(item, value));
  }
  
  if (typeof container === 'object') {
    try {
      return JSON.stringify(container).includes(value);
    } catch {
      return false;
    }
  }
  
  return false;
}

/**
 * Redact a value for safe reporting
 */
function redactValue(value: string): string {
  if (value.length <= 4) {
    return '****';
  }
  return value[0] + '***' + value.slice(-1);
}

// ============================================================================
// LOG SANITIZATION
// ============================================================================

/**
 * Sanitize logs by redacting sensitive values
 */
export function sanitizeLogs(
  logs: LogCapture[],
  input: Record<string, unknown>,
  properties: BehaviorProperties,
  config: PIIConfig = DEFAULT_PII_CONFIG
): LogCapture[] {
  const neverLoggedFields = getNeverLoggedFields(properties);
  const sensitiveValues = new Map<string, string>();
  
  // Collect sensitive values
  for (const field of neverLoggedFields) {
    const value = input[field];
    if (value !== undefined && value !== null) {
      sensitiveValues.set(String(value), `[REDACTED:${field}]`);
    }
  }
  
  // Also redact config-specified fields
  for (const field of config.forbiddenFields) {
    const value = input[field];
    if (value !== undefined && value !== null) {
      sensitiveValues.set(String(value), `[REDACTED:${field}]`);
    }
  }
  
  return logs.map((log) => ({
    ...log,
    message: redactMessage(log.message, sensitiveValues, config),
    args: log.args.map((arg) => redactArg(arg, sensitiveValues, config)),
  }));
}

/**
 * Redact sensitive values from a message
 */
function redactMessage(
  message: string,
  sensitiveValues: Map<string, string>,
  config: PIIConfig
): string {
  let result = message;
  
  // Redact known sensitive values
  for (const [value, replacement] of sensitiveValues) {
    result = result.split(value).join(replacement);
  }
  
  // Apply pattern redactions
  for (const pattern of config.patterns) {
    result = result.replace(pattern.pattern, pattern.replacement);
  }
  
  return result;
}

/**
 * Redact sensitive values from an argument
 */
function redactArg(
  arg: unknown,
  sensitiveValues: Map<string, string>,
  config: PIIConfig
): unknown {
  if (typeof arg === 'string') {
    return redactMessage(arg, sensitiveValues, config);
  }
  
  if (typeof arg === 'object' && arg !== null) {
    try {
      const json = JSON.stringify(arg);
      const redacted = redactMessage(json, sensitiveValues, config);
      return JSON.parse(redacted);
    } catch {
      return arg;
    }
  }
  
  return arg;
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert that logs don't contain PII
 * Throws if PII is found
 */
export function assertNoPII(
  logs: LogCapture[],
  input: Record<string, unknown>,
  properties: BehaviorProperties,
  config: PIIConfig = DEFAULT_PII_CONFIG
): void {
  const result = checkLogsForPII(logs, input, properties, config);
  
  if (result.hasPII) {
    const messages = result.violations.map((v) => 
      `  - ${v.field} found in ${v.location}: "${v.leakedValue}"`
    );
    
    throw new Error(
      `PII detected in logs:\n${messages.join('\n')}`
    );
  }
}

/**
 * Create a log checker for a specific behavior
 */
export function createPIIChecker(
  properties: BehaviorProperties,
  config: PIIConfig = DEFAULT_PII_CONFIG
) {
  return {
    /**
     * Check logs for PII
     */
    check(logs: LogCapture[], input: Record<string, unknown>): PIICheckResult {
      return checkLogsForPII(logs, input, properties, config);
    },
    
    /**
     * Assert no PII in logs
     */
    assert(logs: LogCapture[], input: Record<string, unknown>): void {
      assertNoPII(logs, input, properties, config);
    },
    
    /**
     * Sanitize logs by redacting PII
     */
    sanitize(logs: LogCapture[], input: Record<string, unknown>): LogCapture[] {
      return sanitizeLogs(logs, input, properties, config);
    },
    
    /**
     * Get fields that should never be logged
     */
    getNeverLoggedFields(): string[] {
      return getNeverLoggedFields(properties);
    },
  };
}
