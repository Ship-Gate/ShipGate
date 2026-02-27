/**
 * ISL Unified Logger - Formatters
 * 
 * Provides formatting functions for human-readable and JSON output.
 * JSON format is compatible with evidence report structure.
 */

import type { ISLLogEvent, LogLevel } from './logTypes.js';

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  
  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Background colors
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
} as const;

/**
 * Color mapping for log levels
 */
const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: COLORS.gray,
  info: COLORS.cyan,
  warn: COLORS.yellow,
  error: COLORS.red,
  fatal: `${COLORS.bgRed}${COLORS.white}${COLORS.bold}`,
};

/**
 * Level badges for pretty output
 */
const LEVEL_BADGES: Record<LogLevel, string> = {
  debug: 'DBG',
  info: 'INF',
  warn: 'WRN',
  error: 'ERR',
  fatal: 'FTL',
};

/**
 * Subsystem short names
 */
const SUBSYSTEM_SHORT: Record<string, string> = {
  translator: 'TRN',
  agent: 'AGT',
  verifier: 'VRF',
  parser: 'PRS',
  typechecker: 'TYP',
  codegen: 'GEN',
  cli: 'CLI',
  lsp: 'LSP',
  core: 'COR',
};

/**
 * Format options for formatters
 */
export interface FormatOptions {
  /** Enable ANSI colors */
  colors?: boolean;
  /** Include timestamp */
  timestamps?: boolean;
  /** Include data fields inline */
  inlineData?: boolean;
  /** Maximum inline data string length */
  maxDataLength?: number;
}

const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
  colors: true,
  timestamps: true,
  inlineData: true,
  maxDataLength: 80,
};

/**
 * Format timestamp for pretty output
 */
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toISOString().slice(11, 23); // HH:MM:SS.mmm
}

/**
 * Colorize text if colors are enabled
 */
function colorize(text: string, color: string, enabled: boolean): string {
  return enabled ? `${color}${text}${COLORS.reset}` : text;
}

/**
 * Truncate string to max length
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Format data object for inline display
 */
function formatInlineData(data: Record<string, unknown>, maxLen: number): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    const valueStr = typeof value === 'string' 
      ? value 
      : JSON.stringify(value);
    pairs.push(`${key}=${truncate(valueStr, 30)}`);
  }
  return truncate(pairs.join(' '), maxLen);
}

/**
 * Format event for human-readable pretty output
 * 
 * Example output:
 * 12:34:56.789 INF [TRN] translate:start Processing spec auth.isl specName=auth.isl
 * 12:34:57.123 ERR [VRF] verify:error Clause failed: user.exists
 */
export function formatPretty(event: ISLLogEvent, options: FormatOptions = {}): string {
  const opts = { ...DEFAULT_FORMAT_OPTIONS, ...options };
  const parts: string[] = [];
  
  // Extract with defaults
  const colors = opts.colors ?? true;
  const timestamps = opts.timestamps ?? true;
  const inlineData = opts.inlineData ?? true;
  const maxDataLength = opts.maxDataLength ?? 80;
  
  // Timestamp
  if (timestamps) {
    parts.push(colorize(formatTime(event.timestamp), COLORS.dim, colors));
  }
  
  // Level badge
  const levelColor = LEVEL_COLORS[event.level];
  const badge = LEVEL_BADGES[event.level];
  parts.push(colorize(badge, levelColor, colors));
  
  // Subsystem tag
  const subsystemShort = SUBSYSTEM_SHORT[event.subsystem] || event.subsystem.slice(0, 3).toUpperCase();
  parts.push(colorize(`[${subsystemShort}]`, COLORS.magenta, colors));
  
  // Event name
  parts.push(colorize(event.event, COLORS.blue, colors));
  
  // Message
  parts.push(event.message);
  
  // Duration (if present)
  if (event.durationMs !== undefined) {
    const durationStr = event.durationMs >= 1000 
      ? `${(event.durationMs / 1000).toFixed(2)}s`
      : `${event.durationMs}ms`;
    parts.push(colorize(`(${durationStr})`, COLORS.dim, colors));
  }
  
  // Correlation ID (if present)
  if (event.correlationId) {
    parts.push(colorize(`cid=${event.correlationId.slice(0, 8)}`, COLORS.dim, colors));
  }
  
  // Inline data
  if (inlineData && event.data) {
    const dataStr = formatInlineData(event.data, maxDataLength);
    if (dataStr) {
      parts.push(colorize(dataStr, COLORS.dim, colors));
    }
  }
  
  let output = parts.join(' ');
  
  // Error details on separate lines
  if (event.error) {
    const errorLines: string[] = [];
    const indent = '    ';
    const errColor = opts.colors ? COLORS.red : '';
    const reset = opts.colors ? COLORS.reset : '';
    
    errorLines.push(`${errColor}${indent}Error: ${event.error.message}${reset}`);
    
    if (event.error.code) {
      errorLines.push(`${errColor}${indent}Code: ${event.error.code}${reset}`);
    }
    
    if (event.error.stack) {
      const stackLines = event.error.stack.split('\n').slice(0, 5);
      for (const line of stackLines) {
        errorLines.push(`${COLORS.dim}${indent}${line.trim()}${reset}`);
      }
    }
    
    output += '\n' + errorLines.join('\n');
  }
  
  return output;
}

/**
 * Format event as JSON (compatible with evidence report artifacts)
 * 
 * This format can be used as evidence artifacts with type 'log'
 */
export function formatJSON(event: ISLLogEvent): string {
  // Create a clean copy without undefined values
  const cleanEvent: Record<string, unknown> = {
    timestamp: event.timestamp,
    level: event.level,
    event: event.event,
    subsystem: event.subsystem,
    category: event.category,
    message: event.message,
  };
  
  // Add optional fields only if present
  if (event.correlationId) cleanEvent.correlationId = event.correlationId;
  if (event.specFingerprint) cleanEvent.specFingerprint = event.specFingerprint;
  if (event.specName) cleanEvent.specName = event.specName;
  if (event.durationMs !== undefined) cleanEvent.durationMs = event.durationMs;
  if (event.data) cleanEvent.data = event.data;
  if (event.error) cleanEvent.error = event.error;
  
  return JSON.stringify(cleanEvent);
}

/**
 * Format event as NDJSON (newline-delimited JSON)
 * Useful for log streaming and aggregation systems
 */
export function formatNDJSON(event: ISLLogEvent): string {
  return formatJSON(event) + '\n';
}

/**
 * Parse JSON log line back to ISLLogEvent
 */
export function parseJSONLog(line: string): ISLLogEvent {
  return JSON.parse(line) as ISLLogEvent;
}

/**
 * Format multiple events as a JSON array (for batch export)
 */
export function formatJSONArray(events: ISLLogEvent[]): string {
  return JSON.stringify(events, null, 2);
}

/**
 * Create evidence artifact from log event
 * Compatible with EvidenceArtifact type from evidenceTypes
 */
export function toEvidenceArtifact(event: ISLLogEvent, id: string): {
  id: string;
  type: 'log';
  name: string;
  content: string;
  mimeType: string;
  createdAt: string;
  metadata: Record<string, unknown>;
} {
  return {
    id,
    type: 'log',
    name: `${event.subsystem}:${event.event}`,
    content: formatJSON(event),
    mimeType: 'application/json',
    createdAt: event.timestamp,
    metadata: {
      level: event.level,
      category: event.category,
      subsystem: event.subsystem,
    },
  };
}
