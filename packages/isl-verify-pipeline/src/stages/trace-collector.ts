/**
 * Trace Collector Stage
 * 
 * Collects execution traces from test runs for postcondition/invariant evaluation.
 * Supports both inline trace capture and file-based trace collection.
 * 
 * @module @isl-lang/verify-pipeline
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  TraceCollectorOutput,
  ExecutionTrace,
  TraceEvent,
  StageError,
} from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface TraceCollectorConfig {
  /** Directory containing trace files */
  traceDir?: string;
  /** Pattern for trace files */
  pattern?: string;
  /** Maximum events per trace */
  maxEvents?: number;
  /** Redact PII from traces */
  redactPii?: boolean;
  /** Filter traces by behavior */
  behaviors?: string[];
}

// ============================================================================
// PII Redaction
// ============================================================================

const PII_FIELDS = new Set([
  'password', 'token', 'accessToken', 'refreshToken', 'apiKey', 'secret',
  'authorization', 'auth', 'credential', 'credentials',
  'email', 'phone', 'phoneNumber', 'ssn', 'socialSecurityNumber',
  'creditCard', 'cardNumber', 'cvv', 'cvc',
  'ipAddress', 'ip', 'userAgent',
  'firstName', 'lastName', 'fullName', 'name',
  'address', 'streetAddress', 'city', 'state', 'zipCode', 'postalCode',
  'dateOfBirth', 'dob', 'birthDate',
]);

const PII_PATTERNS = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL_REDACTED]' },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN_REDACTED]' },
  { pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, replacement: '[CARD_REDACTED]' },
  { pattern: /\b\d{3}[- ]?\d{3}[- ]?\d{4}\b/g, replacement: '[PHONE_REDACTED]' },
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[IP_REDACTED]' },
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, replacement: 'Bearer [TOKEN_REDACTED]' },
  { pattern: /\beyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\b/g, replacement: '[JWT_REDACTED]' },
];

function redactPii(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  
  if (typeof value === 'string') {
    let redacted = value;
    for (const { pattern, replacement } of PII_PATTERNS) {
      redacted = redacted.replace(pattern, replacement);
    }
    return redacted;
  }
  
  if (Array.isArray(value)) {
    return value.map(redactPii);
  }
  
  if (typeof value === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (PII_FIELDS.has(key.toLowerCase())) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactPii(val);
      }
    }
    return redacted;
  }
  
  return value;
}

// ============================================================================
// Trace Collection
// ============================================================================

/**
 * Collect traces from the specified directory
 */
export async function collectTraces(config: TraceCollectorConfig): Promise<TraceCollectorOutput> {
  const traceDir = config.traceDir || path.join(process.cwd(), '.verify-pipeline', 'traces');
  const maxEvents = config.maxEvents || 10000;
  
  try {
    await fs.access(traceDir);
  } catch {
    // No trace directory - return empty results
    return {
      traces: [],
      summary: {
        totalTraces: 0,
        totalEvents: 0,
        behaviors: [],
        checksPassed: 0,
        checksFailed: 0,
      },
    };
  }
  
  const traces: ExecutionTrace[] = [];
  const files = await fs.readdir(traceDir);
  const traceFiles = files.filter(f => 
    f.endsWith('.json') && 
    f !== 'index.json' &&
    (config.pattern ? new RegExp(config.pattern).test(f) : true)
  );
  
  for (const file of traceFiles) {
    try {
      const content = await fs.readFile(path.join(traceDir, file), 'utf-8');
      const trace = JSON.parse(content) as ExecutionTrace;
      
      // Filter by behavior if specified
      if (config.behaviors && trace.behavior && !config.behaviors.includes(trace.behavior)) {
        continue;
      }
      
      // Truncate events if needed
      if (trace.events.length > maxEvents) {
        trace.events = trace.events.slice(0, maxEvents);
      }
      
      // Redact PII if enabled
      if (config.redactPii) {
        trace.events = trace.events.map(redactEvent);
        if (trace.initialState) {
          trace.initialState = redactPii(trace.initialState) as Record<string, unknown>;
        }
      }
      
      traces.push(trace);
    } catch (error) {
      // Skip invalid trace files
      console.warn(`Failed to parse trace file ${file}:`, error);
    }
  }
  
  // Calculate summary
  const behaviors = new Set<string>();
  let totalEvents = 0;
  let checksPassed = 0;
  let checksFailed = 0;
  
  for (const trace of traces) {
    if (trace.behavior) behaviors.add(trace.behavior);
    totalEvents += countEvents(trace.events);
    
    for (const event of flattenEvents(trace.events)) {
      if (event.check) {
        if (event.check.passed) checksPassed++;
        else checksFailed++;
      }
    }
  }
  
  return {
    traces,
    summary: {
      totalTraces: traces.length,
      totalEvents,
      behaviors: Array.from(behaviors).sort(),
      checksPassed,
      checksFailed,
    },
  };
}

/**
 * Collect traces from global test context (inline capture)
 */
export function collectInlineTraces(): ExecutionTrace[] {
  // Check for global trace collection
  const globalTraces = (globalThis as { __ISL_TRACES__?: ExecutionTrace[] }).__ISL_TRACES__;
  if (globalTraces && Array.isArray(globalTraces)) {
    return globalTraces;
  }
  return [];
}

/**
 * Write traces to the specified directory
 */
export async function writeTraces(
  traces: ExecutionTrace[],
  outputDir: string
): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  
  const index: Array<{ id: string; name: string; behavior?: string; passed?: boolean }> = [];
  
  for (const trace of traces) {
    const filename = `${trace.id}.json`;
    await fs.writeFile(
      path.join(outputDir, filename),
      JSON.stringify(trace, null, 2)
    );
    
    index.push({
      id: trace.id,
      name: trace.name,
      behavior: trace.behavior,
      passed: trace.metadata?.passed,
    });
  }
  
  // Write index
  await fs.writeFile(
    path.join(outputDir, 'index.json'),
    JSON.stringify(index, null, 2)
  );
}

// ============================================================================
// Trace Utilities
// ============================================================================

function redactEvent(event: TraceEvent): TraceEvent {
  return {
    ...event,
    inputs: event.inputs ? redactPii(event.inputs) as Record<string, unknown> : undefined,
    outputs: event.outputs ? redactPii(event.outputs) as Record<string, unknown> : undefined,
    stateChange: event.stateChange ? {
      ...event.stateChange,
      oldValue: redactPii(event.stateChange.oldValue),
      newValue: redactPii(event.stateChange.newValue),
    } : undefined,
    events: event.events ? event.events.map(redactEvent) : undefined,
  };
}

function countEvents(events: TraceEvent[]): number {
  let count = events.length;
  for (const event of events) {
    if (event.events) {
      count += countEvents(event.events);
    }
  }
  return count;
}

function flattenEvents(events: TraceEvent[]): TraceEvent[] {
  const result: TraceEvent[] = [];
  for (const event of events) {
    result.push(event);
    if (event.events) {
      result.push(...flattenEvents(event.events));
    }
  }
  return result;
}

/**
 * Find trace events by behavior
 */
export function findTracesByBehavior(
  traces: ExecutionTrace[],
  behavior: string
): ExecutionTrace[] {
  return traces.filter(t => t.behavior === behavior);
}

/**
 * Find trace slice for a specific handler call
 */
export function findTraceSlice(
  trace: ExecutionTrace,
  handler: string
): TraceEvent[] {
  const events = flattenEvents(trace.events);
  
  // Find the handler call and return events
  const callIndex = events.findIndex(e => 
    e.kind === 'handler_call' && e.handler === handler
  );
  
  if (callIndex === -1) return [];
  
  // Find the corresponding return or error
  const returnIndex = events.findIndex((e, i) => 
    i > callIndex && 
    (e.kind === 'handler_return' || e.kind === 'handler_error') &&
    e.handler === handler
  );
  
  if (returnIndex === -1) {
    // No return found - return all events after call
    return events.slice(callIndex);
  }
  
  return events.slice(callIndex, returnIndex + 1);
}

/**
 * Extract state snapshots from trace events
 */
export function extractStateSnapshots(events: TraceEvent[]): {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
} {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  
  for (const event of events) {
    if (event.stateChange) {
      const { path, oldValue, newValue } = event.stateChange;
      
      // Track old values (first occurrence)
      if (!(path in before)) {
        before[path] = oldValue;
      }
      
      // Track new values (last occurrence)
      after[path] = newValue;
    }
  }
  
  return { before, after };
}

function createError(
  category: StageError['category'],
  code: string,
  message: string
): StageError {
  return {
    category,
    code,
    message,
    stage: 'trace_collector',
    recoverable: false,
  };
}
