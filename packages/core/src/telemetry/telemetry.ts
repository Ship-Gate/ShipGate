/**
 * ISL Telemetry - Main Interface
 * 
 * Provides opt-in local telemetry for ISL operations.
 * All data is stored locally in .vibecheck/telemetry/events.jsonl
 * 
 * Features:
 * - Opt-in by default (disabled unless explicitly enabled)
 * - Local file storage only (no network calls)
 * - Automatic secret redaction
 * - Session-based event grouping
 * 
 * @example
 * ```typescript
 * import { createTelemetry, TELEMETRY_EVENTS } from '@isl/core/telemetry';
 * 
 * const telemetry = createTelemetry({ enabled: true });
 * 
 * telemetry.recordEvent(TELEMETRY_EVENTS.VERIFY_COMPLETE, {
 *   specName: 'auth.isl',
 *   score: 95,
 *   duration: 1234,
 * });
 * 
 * await telemetry.close();
 * ```
 */

import type {
  TelemetryConfig,
  TelemetryEvent,
  TelemetryMetadata,
  TelemetryRecorder,
  RedactionPattern,
} from './telemetryTypes.js';
import {
  DEFAULT_REDACTION_PATTERNS,
  TELEMETRY_ENV_VAR,
  TELEMETRY_DIR_ENV_VAR,
} from './telemetryTypes.js';

// Re-export types and constants
export type {
  TelemetryConfig,
  TelemetryEvent,
  TelemetryMetadata,
  TelemetryRecorder,
  RedactionPattern,
} from './telemetryTypes.js';
export {
  TELEMETRY_EVENTS,
  DEFAULT_REDACTION_PATTERNS,
  TELEMETRY_ENV_VAR,
  TELEMETRY_DIR_ENV_VAR,
} from './telemetryTypes.js';

/**
 * Default telemetry configuration
 */
const DEFAULT_CONFIG: Required<TelemetryConfig> = {
  enabled: false,
  outputDir: '.vibecheck/telemetry',
  filename: 'events.jsonl',
  redactSecrets: true,
  redactionPatterns: DEFAULT_REDACTION_PATTERNS,
  includeMetadata: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  flushIntervalMs: 1000,
};

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `ses_${timestamp}_${random}`;
}

/**
 * Get system metadata for telemetry events
 */
function getMetadata(): TelemetryMetadata {
  const metadata: TelemetryMetadata = {};
  
  if (typeof process !== 'undefined') {
    metadata.nodeVersion = process.version;
    metadata.os = process.platform;
  }
  
  // ISL version could be injected via build process
  metadata.islVersion = '0.1.0';
  
  return metadata;
}

/**
 * Check if telemetry is enabled via environment variable
 */
function isEnabledViaEnv(): boolean {
  if (typeof process !== 'undefined' && process.env) {
    const value = process.env[TELEMETRY_ENV_VAR];
    return value === '1' || value === 'true' || value === 'yes';
  }
  return false;
}

/**
 * Get output directory from environment variable
 */
function getOutputDirFromEnv(): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[TELEMETRY_DIR_ENV_VAR];
  }
  return undefined;
}

/**
 * Deep clone and redact sensitive data from an object
 */
export function redactSecrets(
  data: unknown,
  patterns: RedactionPattern[] = DEFAULT_REDACTION_PATTERNS,
  visited = new WeakSet<object>()
): unknown {
  // Handle null/undefined
  if (data === null || data === undefined) {
    return data;
  }
  
  // Handle primitives
  if (typeof data === 'string') {
    return redactString(data, patterns);
  }
  
  if (typeof data !== 'object') {
    return data;
  }
  
  // Prevent circular references
  if (visited.has(data as object)) {
    return '[CIRCULAR]';
  }
  visited.add(data as object);
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => redactSecrets(item, patterns, visited));
  }
  
  // Handle objects
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    // Check if key itself suggests sensitive data
    const lowerKey = key.toLowerCase();
    if (isSensitiveKey(lowerKey)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redactSecrets(value, patterns, visited);
    }
  }
  
  return result;
}

/**
 * Check if a key name suggests sensitive data
 */
function isSensitiveKey(key: string): boolean {
  const sensitivePatterns = [
    'password',
    'passwd',
    'pwd',
    'secret',
    'token',
    'apikey',
    'api_key',
    'api-key',
    'auth',
    'authorization',
    'bearer',
    'credential',
    'private',
    'privatekey',
    'private_key',
    'private-key',
    'accesskey',
    'access_key',
    'access-key',
    'secretkey',
    'secret_key',
    'secret-key',
  ];
  
  return sensitivePatterns.some(pattern => key.includes(pattern));
}

/**
 * Redact sensitive patterns from a string
 */
function redactString(str: string, patterns: RedactionPattern[]): string {
  let result = str;
  
  for (const { pattern, replacement } of patterns) {
    // Create a new RegExp to reset lastIndex
    const regex = new RegExp(pattern.source, pattern.flags);
    result = result.replace(regex, replacement ?? '[REDACTED]');
  }
  
  return result;
}

/**
 * No-op telemetry recorder for when telemetry is disabled
 */
class NullTelemetryRecorder implements TelemetryRecorder {
  private sessionId = generateSessionId();
  
  recordEvent(): void {
    // No-op
  }
  
  async recordEventAsync(): Promise<void> {
    // No-op
  }
  
  async flush(): Promise<void> {
    // No-op
  }
  
  async close(): Promise<void> {
    // No-op
  }
  
  isEnabled(): boolean {
    return false;
  }
  
  getSessionId(): string {
    return this.sessionId;
  }
  
  setCorrelationId(): void {
    // No-op
  }
}

/**
 * In-memory telemetry recorder (for testing)
 */
export class MemoryTelemetryRecorder implements TelemetryRecorder {
  private events: TelemetryEvent[] = [];
  private sessionId = generateSessionId();
  private correlationId?: string;
  private config: Required<TelemetryConfig>;
  
  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config, enabled: true };
  }
  
  recordEvent(event: string, payload: Record<string, unknown>): void {
    const redactedPayload = this.config.redactSecrets
      ? redactSecrets(payload, this.config.redactionPatterns) as Record<string, unknown>
      : payload;
    
    const telemetryEvent: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      event,
      sessionId: this.sessionId,
      payload: redactedPayload,
    };
    
    if (this.correlationId) {
      telemetryEvent.correlationId = this.correlationId;
    }
    
    if (this.config.includeMetadata) {
      telemetryEvent.metadata = getMetadata();
    }
    
    this.events.push(telemetryEvent);
  }
  
  async recordEventAsync(event: string, payload: Record<string, unknown>): Promise<void> {
    this.recordEvent(event, payload);
  }
  
  async flush(): Promise<void> {
    // No-op for memory recorder
  }
  
  async close(): Promise<void> {
    // No-op for memory recorder
  }
  
  isEnabled(): boolean {
    return true;
  }
  
  getSessionId(): string {
    return this.sessionId;
  }
  
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }
  
  /**
   * Get all recorded events (for testing)
   */
  getEvents(): TelemetryEvent[] {
    return [...this.events];
  }
  
  /**
   * Clear all recorded events (for testing)
   */
  clearEvents(): void {
    this.events = [];
  }
}

/**
 * Create a telemetry recorder instance
 * 
 * By default, telemetry is DISABLED. To enable:
 * 1. Pass { enabled: true } in config
 * 2. Set ISL_TELEMETRY=1 environment variable
 * 
 * @param config Telemetry configuration
 * @returns TelemetryRecorder instance
 * 
 * @example
 * ```typescript
 * // Opt-in via config
 * const telemetry = createTelemetry({ enabled: true });
 * 
 * // Or via environment variable
 * // ISL_TELEMETRY=1 node your-script.js
 * const telemetry = createTelemetry();
 * 
 * // Record events
 * telemetry.recordEvent('verify:complete', { score: 95 });
 * 
 * // Always close when done
 * await telemetry.close();
 * ```
 */
export function createTelemetry(config: Partial<TelemetryConfig> = {}): TelemetryRecorder {
  // Check if enabled via config or environment
  const enabled = config.enabled ?? isEnabledViaEnv();
  
  if (!enabled) {
    return new NullTelemetryRecorder();
  }
  
  // Merge config with defaults and environment
  const fullConfig: Required<TelemetryConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
    enabled: true,
    outputDir: config.outputDir ?? getOutputDirFromEnv() ?? DEFAULT_CONFIG.outputDir,
  };
  
  // Import and create local recorder (lazy to avoid fs import issues in browser)
  // For now, return memory recorder - localRecorder.ts handles file I/O
  return new MemoryTelemetryRecorder(fullConfig);
}

/**
 * Create a telemetry recorder that writes to local file
 * 
 * @param config Telemetry configuration
 * @returns Promise<TelemetryRecorder> Local file recorder
 */
export async function createLocalTelemetry(
  config: Partial<TelemetryConfig> = {}
): Promise<TelemetryRecorder> {
  const enabled = config.enabled ?? isEnabledViaEnv();
  
  if (!enabled) {
    return new NullTelemetryRecorder();
  }
  
  // Dynamic import to avoid issues in non-Node environments
  const { LocalTelemetryRecorder } = await import('./localRecorder.js');
  
  const fullConfig: Required<TelemetryConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
    enabled: true,
    outputDir: config.outputDir ?? getOutputDirFromEnv() ?? DEFAULT_CONFIG.outputDir,
  };
  
  return new LocalTelemetryRecorder(fullConfig);
}

/**
 * Create a no-op telemetry recorder (for testing or disabled state)
 */
export function createNullTelemetry(): TelemetryRecorder {
  return new NullTelemetryRecorder();
}
