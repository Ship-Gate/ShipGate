/**
 * ISL Telemetry - Type Definitions
 * 
 * Provides type definitions for the opt-in local telemetry system.
 * All telemetry is stored locally in .shipgate/telemetry/events.jsonl
 * No network calls are made.
 */

/**
 * Telemetry event structure stored in JSONL format
 */
export interface TelemetryEvent {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Event name (e.g., 'translate:complete', 'verify:score') */
  event: string;
  /** Session ID for grouping related events */
  sessionId: string;
  /** Optional correlation ID for tracing */
  correlationId?: string;
  /** Event payload (automatically redacted) */
  payload: Record<string, unknown>;
  /** Metadata about the event */
  metadata?: TelemetryMetadata;
}

/**
 * Metadata attached to telemetry events
 */
export interface TelemetryMetadata {
  /** ISL version */
  islVersion?: string;
  /** Node.js version */
  nodeVersion?: string;
  /** Operating system */
  os?: string;
  /** Machine ID (anonymous, opt-in) */
  machineId?: string;
}

/**
 * Configuration for the telemetry recorder
 */
export interface TelemetryConfig {
  /** Enable telemetry (default: false - opt-in) */
  enabled: boolean;
  /** Output directory (default: .shipgate/telemetry) */
  outputDir?: string;
  /** Output filename (default: events.jsonl) */
  filename?: string;
  /** Enable secret redaction (default: true) */
  redactSecrets?: boolean;
  /** Custom redaction patterns */
  redactionPatterns?: RedactionPattern[];
  /** Include metadata (default: true) */
  includeMetadata?: boolean;
  /** Maximum file size before rotation in bytes (default: 10MB) */
  maxFileSize?: number;
  /** Flush interval in milliseconds (default: 1000) */
  flushIntervalMs?: number;
}

/**
 * Custom redaction pattern for sensitive data
 */
export interface RedactionPattern {
  /** Pattern name for identification */
  name: string;
  /** Regex pattern to match */
  pattern: RegExp;
  /** Replacement string (default: '[REDACTED]') */
  replacement?: string;
}

/**
 * Telemetry recorder interface
 */
export interface TelemetryRecorder {
  /** Record a telemetry event */
  recordEvent(event: string, payload: Record<string, unknown>): void;
  
  /** Record a telemetry event with promise (waits for write) */
  recordEventAsync(event: string, payload: Record<string, unknown>): Promise<void>;
  
  /** Flush pending events to disk */
  flush(): Promise<void>;
  
  /** Close the recorder and flush remaining events */
  close(): Promise<void>;
  
  /** Check if telemetry is enabled */
  isEnabled(): boolean;
  
  /** Get current session ID */
  getSessionId(): string;
  
  /** Set correlation ID for subsequent events */
  setCorrelationId(id: string): void;
}

/**
 * Standard ISL telemetry events
 */
export const TELEMETRY_EVENTS = {
  // Session lifecycle
  SESSION_START: 'session:start',
  SESSION_END: 'session:end',
  
  // Translation events
  TRANSLATE_START: 'translate:start',
  TRANSLATE_COMPLETE: 'translate:complete',
  TRANSLATE_ERROR: 'translate:error',
  
  // Verification events
  VERIFY_START: 'verify:start',
  VERIFY_COMPLETE: 'verify:complete',
  VERIFY_SCORE: 'verify:score',
  VERIFY_ERROR: 'verify:error',
  
  // Agent events
  AGENT_PLAN: 'agent:plan',
  AGENT_EXECUTE: 'agent:execute',
  AGENT_FEEDBACK: 'agent:feedback',
  
  // Evidence events
  EVIDENCE_COLLECT: 'evidence:collect',
  EVIDENCE_REPORT: 'evidence:report',
  
  // CLI events
  CLI_COMMAND: 'cli:command',
  CLI_ERROR: 'cli:error',
  
  // Performance events
  PERF_TIMING: 'perf:timing',
  PERF_MEMORY: 'perf:memory',
} as const;

export type TelemetryEventName = typeof TELEMETRY_EVENTS[keyof typeof TELEMETRY_EVENTS] | string;

/**
 * Default redaction patterns for common secrets
 */
export const DEFAULT_REDACTION_PATTERNS: RedactionPattern[] = [
  // API Keys (various formats)
  {
    name: 'api_key',
    pattern: /(?:api[_-]?key|apikey)['":\s]*[=:]?\s*['"]?([a-zA-Z0-9_\-]{20,})/gi,
    replacement: '[API_KEY_REDACTED]',
  },
  // Bearer tokens
  {
    name: 'bearer_token',
    pattern: /bearer\s+[a-zA-Z0-9_\-\.]+/gi,
    replacement: 'Bearer [TOKEN_REDACTED]',
  },
  // JWT tokens
  {
    name: 'jwt',
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    replacement: '[JWT_REDACTED]',
  },
  // Passwords in various formats
  {
    name: 'password',
    pattern: /(?:password|passwd|pwd|secret)['":\s]*[=:]?\s*['"]?([^\s'"]{4,})/gi,
    replacement: '[PASSWORD_REDACTED]',
  },
  // AWS keys
  {
    name: 'aws_key',
    pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g,
    replacement: '[AWS_KEY_REDACTED]',
  },
  // AWS secret
  {
    name: 'aws_secret',
    pattern: /(?:aws[_-]?secret[_-]?(?:access[_-]?)?key)['":\s]*[=:]?\s*['"]?([a-zA-Z0-9/+=]{40})/gi,
    replacement: '[AWS_SECRET_REDACTED]',
  },
  // Private keys
  {
    name: 'private_key',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    replacement: '[PRIVATE_KEY_REDACTED]',
  },
  // GitHub tokens
  {
    name: 'github_token',
    pattern: /gh[pousr]_[a-zA-Z0-9]{36,}/g,
    replacement: '[GITHUB_TOKEN_REDACTED]',
  },
  // Stripe keys
  {
    name: 'stripe_key',
    pattern: /(?:sk|pk|rk)_(?:test|live)_[a-zA-Z0-9]{24,}/g,
    replacement: '[STRIPE_KEY_REDACTED]',
  },
  // Generic tokens in headers/configs
  {
    name: 'auth_token',
    pattern: /(?:auth[_-]?token|access[_-]?token|refresh[_-]?token)['":\s]*[=:]?\s*['"]?([a-zA-Z0-9_\-\.]{20,})/gi,
    replacement: '[AUTH_TOKEN_REDACTED]',
  },
  // Database connection strings
  {
    name: 'connection_string',
    pattern: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^\s'"]+/gi,
    replacement: '[CONNECTION_STRING_REDACTED]',
  },
  // Email addresses (optional, can be sensitive)
  {
    name: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL_REDACTED]',
  },
  // IP addresses (optional)
  {
    name: 'ip_address',
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: '[IP_REDACTED]',
  },
];

/**
 * Environment variable check for telemetry opt-in
 */
export const TELEMETRY_ENV_VAR = 'ISL_TELEMETRY';
export const TELEMETRY_DIR_ENV_VAR = 'ISL_TELEMETRY_DIR';
