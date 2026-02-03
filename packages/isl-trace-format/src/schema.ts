/**
 * JSON Schema for Trace Events
 * 
 * Validates trace events against the stable schema.
 * 
 * @module @isl-lang/trace-format/schema
 */

import Ajv from 'ajv';
import type { TraceEvent, Trace } from './types.js';

// Optional ajv-formats support for date-time validation
// If not available, date-time format will be ignored (warnings only)
let addFormats: ((ajv: Ajv) => void) | null = null;
try {
  // Dynamic import to make it optional
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const formatsModule = require('ajv-formats');
  addFormats = formatsModule.default || formatsModule;
} catch {
  // ajv-formats not available, date-time validation will be skipped
  // This is fine - AJV will just ignore the format and warn
}

/**
 * Core event kinds (handler lifecycle)
 */
export const CORE_EVENT_KINDS = [
  'handler_call',
  'handler_return',
  'handler_error',
  'state_change',
  'check',
  'invariant',
  'precondition',
  'postcondition',
  'temporal',
  'nested',
] as const;

/**
 * Login/Auth event kinds (for Login clause verification)
 */
export const LOGIN_EVENT_KINDS = [
  'rate_limit_checked',
  'audit_written',
  'session_created',
  'user_updated',
  'error_returned',
] as const;

/**
 * All event kinds
 */
export const ALL_EVENT_KINDS = [...CORE_EVENT_KINDS, ...LOGIN_EVENT_KINDS] as const;

/**
 * Timing info schema for temporal constraint verification
 */
export const timingInfoSchema = {
  type: 'object',
  description: 'Timing information for temporal constraint verification',
  properties: {
    startMs: {
      type: 'number',
      description: 'Start timestamp in milliseconds (high-res)',
    },
    endMs: {
      type: 'number',
      description: 'End timestamp in milliseconds (high-res)',
    },
    durationMs: {
      type: 'number',
      description: 'Duration in milliseconds',
    },
    sequence: {
      type: 'number',
      description: 'Sequence number within the trace (for ordering verification)',
    },
  },
  required: ['startMs'],
} as const;

/**
 * JSON Schema for TraceEvent (self-referential for nested events)
 * Note: The $id is used so nested events can properly reference the TraceEvent schema
 */
export const traceEventSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'TraceEvent',
  type: 'object',
  required: ['time', 'kind', 'correlationId', 'handler', 'inputs', 'outputs', 'events'],
  properties: {
    time: {
      type: 'string',
      format: 'date-time',
      description: 'ISO 8601 timestamp',
    },
    kind: {
      type: 'string',
      enum: ALL_EVENT_KINDS,
      description: 'Event kind/type',
    },
    correlationId: {
      type: 'string',
      description: 'Correlation ID for tracing across systems',
    },
    handler: {
      type: 'string',
      description: 'Handler/function name',
    },
    inputs: {
      type: 'object',
      description: 'Sanitized inputs (PII redacted)',
      additionalProperties: true,
    },
    outputs: {
      type: 'object',
      description: 'Sanitized outputs (PII redacted)',
      additionalProperties: true,
    },
    events: {
      type: 'array',
      description: 'Nested events (for hierarchical traces)',
      items: { $ref: 'TraceEvent' },
    },
    metadata: {
      type: 'object',
      description: 'Optional metadata',
      additionalProperties: true,
    },
    timing: timingInfoSchema,
  },
  additionalProperties: false,
} as const;

/**
 * Login-specific trace metadata schema
 */
export const loginTraceMetadataSchema = {
  type: 'object',
  description: 'Login-specific trace metadata',
  properties: {
    outcome: {
      type: 'string',
      enum: ['success', 'invalid_credentials', 'rate_limited', 'account_locked', 'validation_error', 'server_error'],
      description: 'Login outcome',
    },
    userIdHash: {
      type: 'string',
      description: 'User identifier (sanitized hash)',
    },
    mfaRequired: {
      type: 'boolean',
      description: 'Whether MFA was required',
    },
    mfaCompleted: {
      type: 'boolean',
      description: 'Whether MFA was completed',
    },
    recentFailedAttempts: {
      type: 'number',
      description: 'Number of recent failed attempts (anonymized)',
    },
    accountLocked: {
      type: 'boolean',
      description: 'Whether account was locked after this attempt',
    },
  },
  required: ['outcome'],
} as const;

/**
 * JSON Schema for Trace
 */
export const traceSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['id', 'name', 'domain', 'startTime', 'correlationId', 'events'],
  properties: {
    id: {
      type: 'string',
      description: 'Trace ID',
    },
    name: {
      type: 'string',
      description: 'Trace name/description',
    },
    domain: {
      type: 'string',
      description: 'Domain/behavior name',
    },
    startTime: {
      type: 'string',
      format: 'date-time',
      description: 'Start time (ISO 8601)',
    },
    endTime: {
      type: 'string',
      format: 'date-time',
      description: 'End time (ISO 8601, optional)',
    },
    correlationId: {
      type: 'string',
      description: 'Root correlation ID',
    },
    events: {
      type: 'array',
      description: 'All events in the trace',
      items: { $ref: 'TraceEvent' },
    },
    initialState: {
      type: 'object',
      description: 'Initial state snapshot',
      additionalProperties: true,
    },
    metadata: {
      type: 'object',
      description: 'Metadata',
      properties: {
        testName: { type: 'string' },
        scenario: { type: 'string' },
        implementation: { type: 'string' },
        version: { type: 'string' },
        environment: { type: 'string' },
        passed: { type: 'boolean' },
        failureIndex: { type: 'number' },
        duration: { type: 'number' },
        iteration: { type: 'number' },
        proofBundleId: { type: 'string' },
        auth: loginTraceMetadataSchema,
      },
      additionalProperties: true,
    },
  },
  additionalProperties: false,
} as const;

/**
 * Create an AJV instance with the TraceEvent schema registered
 */
function createAjvWithSchemas(): Ajv {
  const ajv = new Ajv({ allErrors: true });
  if (addFormats !== null) {
    addFormats(ajv);
  }
  // Add the TraceEvent schema so $ref can resolve
  ajv.addSchema(traceEventSchema, 'TraceEvent');
  return ajv;
}

/**
 * Validate a trace event against the schema
 */
export function validateTraceEvent(event: unknown): { valid: boolean; errors?: string[] } {
  const ajv = createAjvWithSchemas();
  const validate = ajv.compile(traceEventSchema);
  const valid = validate(event);

  if (!valid && validate.errors) {
    return {
      valid: false,
      errors: validate.errors.map(err => `${err.instancePath} ${err.message}`),
    };
  }

  return { valid: true };
}

/**
 * Validate a trace against the schema
 */
export function validateTrace(trace: unknown): { valid: boolean; errors?: string[] } {
  const ajv = createAjvWithSchemas();
  const validate = ajv.compile(traceSchema);
  const valid = validate(trace);

  if (!valid && validate.errors) {
    return {
      valid: false,
      errors: validate.errors.map(err => `${err.instancePath} ${err.message}`),
    };
  }

  return { valid: true };
}

/**
 * Validate that a trace event has all required fields
 */
export function isValidTraceEvent(event: unknown): event is TraceEvent {
  if (typeof event !== 'object' || event === null) {
    return false;
  }

  const e = event as Record<string, unknown>;

  return (
    typeof e.time === 'string' &&
    typeof e.kind === 'string' &&
    typeof e.correlationId === 'string' &&
    typeof e.handler === 'string' &&
    typeof e.inputs === 'object' &&
    e.inputs !== null &&
    typeof e.outputs === 'object' &&
    e.outputs !== null &&
    Array.isArray(e.events)
  );
}

/**
 * Validate that a trace has all required fields
 */
export function isValidTrace(trace: unknown): trace is Trace {
  if (typeof trace !== 'object' || trace === null) {
    return false;
  }

  const t = trace as Record<string, unknown>;

  return (
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    typeof t.domain === 'string' &&
    typeof t.startTime === 'string' &&
    typeof t.correlationId === 'string' &&
    Array.isArray(t.events) &&
    t.events.every(isValidTraceEvent)
  );
}
