// ============================================================================
// Sentry Integration Utilities
// ============================================================================

import type { ISLSentryOptions } from './types';
import { DEFAULT_OPTIONS } from './types';

/**
 * Deep clone an object with depth limit
 */
export function deepClone<T>(
  obj: T,
  maxDepth: number = DEFAULT_OPTIONS.maxContextDepth,
  currentDepth: number = 0
): T {
  if (currentDepth >= maxDepth) {
    return '[Max depth exceeded]' as T;
  }

  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item, maxDepth, currentDepth + 1)) as T;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as T;
  }

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key], maxDepth, currentDepth + 1);
    }
  }

  return cloned;
}

/**
 * Sanitize input data by redacting sensitive fields
 */
export function sanitizeInput(
  input: unknown,
  redactFields: string[] = DEFAULT_OPTIONS.redactFields,
  maxDepth: number = DEFAULT_OPTIONS.maxContextDepth,
  maxStringLength: number = DEFAULT_OPTIONS.maxContextStringLength
): unknown {
  return sanitizeValue(input, redactFields, maxDepth, maxStringLength, 0);
}

/**
 * Sanitize output data by redacting sensitive fields
 */
export function sanitizeOutput(
  output: unknown,
  redactFields: string[] = DEFAULT_OPTIONS.redactFields,
  maxDepth: number = DEFAULT_OPTIONS.maxContextDepth,
  maxStringLength: number = DEFAULT_OPTIONS.maxContextStringLength
): unknown {
  return sanitizeValue(output, redactFields, maxDepth, maxStringLength, 0);
}

/**
 * Sanitize state data by redacting sensitive fields
 */
export function sanitizeState(
  state: unknown,
  redactFields: string[] = DEFAULT_OPTIONS.redactFields,
  maxDepth: number = DEFAULT_OPTIONS.maxContextDepth,
  maxStringLength: number = DEFAULT_OPTIONS.maxContextStringLength
): unknown {
  return sanitizeValue(state, redactFields, maxDepth, maxStringLength, 0);
}

/**
 * Internal sanitization function
 */
function sanitizeValue(
  value: unknown,
  redactFields: string[],
  maxDepth: number,
  maxStringLength: number,
  currentDepth: number
): unknown {
  if (currentDepth >= maxDepth) {
    return '[Max depth exceeded]';
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    if (value.length > maxStringLength) {
      return value.substring(0, maxStringLength) + `... [truncated ${value.length - maxStringLength} chars]`;
    }
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'function') {
    return '[Function]';
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof RegExp) {
    return value.toString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    return '[Binary Data]';
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      sanitizeValue(item, redactFields, maxDepth, maxStringLength, currentDepth + 1)
    );
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    const normalizedRedactFields = redactFields.map((f) => f.toLowerCase());

    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (normalizedRedactFields.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeValue(
          val,
          redactFields,
          maxDepth,
          maxStringLength,
          currentDepth + 1
        );
      }
    }

    return sanitized;
  }

  return String(value);
}

/**
 * Generate a unique execution ID
 */
export function generateExecutionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `exec_${timestamp}_${random}`;
}

/**
 * Create a fingerprint for error grouping
 */
export function createFingerprint(
  domain: string,
  behavior: string | undefined,
  checkType: string | undefined,
  expression?: string
): string[] {
  const parts: string[] = [domain];

  if (behavior) {
    parts.push(behavior);
  }

  if (checkType) {
    parts.push(checkType);
  }

  if (expression) {
    // Normalize expression for fingerprinting
    const normalized = expression
      .replace(/\s+/g, ' ')
      .replace(/["'`]/g, '')
      .trim();
    parts.push(normalized);
  }

  return parts;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)}µs`;
  }
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Merge options with defaults
 */
export function mergeOptions<T extends Record<string, unknown>>(
  defaults: T,
  options: Partial<T>
): T {
  const merged = { ...defaults };

  for (const key in options) {
    if (options[key] !== undefined) {
      if (
        typeof options[key] === 'object' &&
        options[key] !== null &&
        !Array.isArray(options[key]) &&
        typeof defaults[key] === 'object' &&
        defaults[key] !== null
      ) {
        merged[key] = {
          ...(defaults[key] as Record<string, unknown>),
          ...(options[key] as Record<string, unknown>),
        } as T[typeof key];
      } else {
        merged[key] = options[key] as T[typeof key];
      }
    }
  }

  return merged;
}

/**
 * Extract domain and behavior from a string pattern
 */
export function extractDomainBehavior(
  pattern: string,
  path: string
): { domain?: string; behavior?: string } | null {
  // Convert pattern like '/api/:domain/:behavior' to regex
  const regexPattern = pattern
    .replace(/:[a-zA-Z]+/g, '([^/]+)')
    .replace(/\//g, '\\/');

  const regex = new RegExp(`^${regexPattern}$`);
  const match = path.match(regex);

  if (!match) {
    return null;
  }

  // Extract named parameters from pattern
  const paramNames = pattern.match(/:[a-zA-Z]+/g) || [];
  const result: { domain?: string; behavior?: string } = {};

  paramNames.forEach((param, index) => {
    const name = param.substring(1); // Remove ':'
    if (name === 'domain') {
      result.domain = match[index + 1];
    } else if (name === 'behavior') {
      result.behavior = match[index + 1];
    }
  });

  return result;
}

/**
 * Check if a path should be skipped
 */
export function shouldSkipPath(path: string, skipPaths: string[]): boolean {
  return skipPaths.some((skipPath) => {
    if (skipPath.endsWith('*')) {
      return path.startsWith(skipPath.slice(0, -1));
    }
    return path === skipPath;
  });
}

/**
 * Safe JSON stringify with circular reference handling
 */
export function safeStringify(obj: unknown, space?: number): string {
  const seen = new WeakSet();

  return JSON.stringify(
    obj,
    (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      if (typeof value === 'bigint') {
        return value.toString();
      }
      if (typeof value === 'function') {
        return '[Function]';
      }
      if (typeof value === 'symbol') {
        return value.toString();
      }
      return value;
    },
    space
  );
}

/**
 * Create sanitization options from ISL options
 */
export function createSanitizationOptions(options: Partial<ISLSentryOptions>): {
  redactFields: string[];
  maxDepth: number;
  maxStringLength: number;
} {
  return {
    redactFields: options.redactFields ?? DEFAULT_OPTIONS.redactFields,
    maxDepth: options.maxContextDepth ?? DEFAULT_OPTIONS.maxContextDepth,
    maxStringLength: options.maxContextStringLength ?? DEFAULT_OPTIONS.maxContextStringLength,
  };
}
