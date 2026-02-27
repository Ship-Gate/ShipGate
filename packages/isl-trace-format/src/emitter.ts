/**
 * Trace Event Emitter
 * 
 * Helper library for emitting trace events with automatic sanitization.
 * 
 * @module @isl-lang/trace-format/emitter
 */

import type {
  TraceEvent,
  Trace,
  TraceEventKind,
  HandlerCallEvent,
  HandlerReturnEvent,
  HandlerErrorEvent,
  StateChangeEvent,
  CheckEvent,
  TraceMetadata,
  TimingInfo,
  RateLimitCheckedEvent,
  AuditWrittenEvent,
  SessionCreatedEvent,
  UserUpdatedEvent,
  ErrorReturnedEvent,
} from './types.js';
import { sanitizeInputs, sanitizeOutputs, sanitizeError } from './redaction.js';
import { randomUUID } from 'crypto';

/**
 * Trace emitter options
 */
export interface TraceEmitterOptions {
  /** Default correlation ID (auto-generated if not provided) */
  correlationId?: string;
  /** Default domain/behavior name */
  domain?: string;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Enable timing capture (default: true) */
  captureTiming?: boolean;
}

/**
 * Trace Event Emitter
 * 
 * Collects and emits trace events with automatic PII redaction.
 */
export class TraceEmitter {
  private correlationId: string;
  private domain: string;
  private events: TraceEvent[] = [];
  private startTime: string;
  private startTimeMs: number;
  private verbose: boolean;
  private captureTiming: boolean;
  private sequenceCounter: number = 0;

  constructor(options: TraceEmitterOptions = {}) {
    this.correlationId = options.correlationId || randomUUID();
    this.domain = options.domain || 'unknown';
    this.startTime = new Date().toISOString();
    this.startTimeMs = Date.now();
    this.verbose = options.verbose || false;
    this.captureTiming = options.captureTiming !== false; // Default true
  }

  /**
   * Create timing info for an event
   */
  private createTiming(startMs?: number, endMs?: number): TimingInfo | undefined {
    if (!this.captureTiming) return undefined;
    
    const now = Date.now();
    const start = startMs ?? now;
    const end = endMs ?? now;
    
    return {
      startMs: start,
      endMs: end,
      durationMs: end - start,
      sequence: this.sequenceCounter++,
    };
  }

  /**
   * Reset the sequence counter (useful for testing)
   */
  resetSequence(): void {
    this.sequenceCounter = 0;
  }

  /**
   * Get the current correlation ID
   */
  getCorrelationId(): string {
    return this.correlationId;
  }

  /**
   * Set a new correlation ID
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  /**
   * Emit a handler call event
   */
  emitHandlerCall(
    handler: string,
    inputs: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): HandlerCallEvent {
    const event: HandlerCallEvent = {
      time: new Date().toISOString(),
      kind: 'handler_call',
      correlationId: this.correlationId,
      handler,
      inputs: sanitizeInputs(inputs),
      outputs: {},
      events: [],
      metadata,
      timing: this.createTiming(),
    };

    this.events.push(event);
    
    if (this.verbose) {
      console.debug(`[Trace] Handler call: ${handler}`, { correlationId: this.correlationId });
    }

    return event;
  }

  /**
   * Emit a handler return event
   */
  emitHandlerReturn(
    handler: string,
    inputs: Record<string, unknown>,
    result: unknown,
    duration?: number,
    metadata?: Record<string, unknown>
  ): HandlerReturnEvent {
    const sanitizedResult = sanitizeOutputs({ result });
    const event: HandlerReturnEvent = {
      time: new Date().toISOString(),
      kind: 'handler_return',
      correlationId: this.correlationId,
      handler,
      inputs: sanitizeInputs(inputs),
      outputs: {
        result: sanitizedResult.result,
        duration,
      },
      events: [],
      metadata,
    };

    this.events.push(event);
    
    if (this.verbose) {
      console.debug(`[Trace] Handler return: ${handler}`, { duration, correlationId: this.correlationId });
    }

    return event;
  }

  /**
   * Emit a handler error event
   */
  emitHandlerError(
    handler: string,
    inputs: Record<string, unknown>,
    error: Error | unknown,
    metadata?: Record<string, unknown>
  ): HandlerErrorEvent {
    const event: HandlerErrorEvent = {
      time: new Date().toISOString(),
      kind: 'handler_error',
      correlationId: this.correlationId,
      handler,
      inputs: sanitizeInputs(inputs),
      outputs: {
        error: sanitizeError(error),
      },
      events: [],
      metadata,
    };

    this.events.push(event);
    
    if (this.verbose) {
      console.debug(`[Trace] Handler error: ${handler}`, { error: sanitizeError(error), correlationId: this.correlationId });
    }

    return event;
  }

  /**
   * Emit a state change event
   */
  emitStateChange(
    handler: string,
    path: string[],
    oldValue: unknown,
    newValue: unknown,
    source: string,
    metadata?: Record<string, unknown>
  ): StateChangeEvent {
    const sanitizedInputs = sanitizeInputs({ path, oldValue });
    const sanitizedOutputs = sanitizeOutputs({ newValue, source });
    const event: StateChangeEvent = {
      time: new Date().toISOString(),
      kind: 'state_change',
      correlationId: this.correlationId,
      handler,
      inputs: {
        path: sanitizedInputs.path as string[],
        oldValue: sanitizedInputs.oldValue,
      },
      outputs: {
        newValue: sanitizedOutputs.newValue,
        source: sanitizedOutputs.source as string,
      },
      events: [],
      metadata,
    };

    this.events.push(event);
    
    if (this.verbose) {
      console.debug(`[Trace] State change: ${path.join('.')}`, { source, correlationId: this.correlationId });
    }

    return event;
  }

  /**
   * Emit a check event (precondition/postcondition/invariant)
   */
  emitCheck(
    handler: string,
    expression: string,
    passed: boolean,
    category: 'precondition' | 'postcondition' | 'invariant' | 'temporal' | 'assertion',
    expected?: unknown,
    actual?: unknown,
    message?: string,
    metadata?: Record<string, unknown>
  ): CheckEvent {
    const sanitizedInputs = sanitizeInputs({ expression, expected });
    const sanitizedOutputs = sanitizeOutputs({ passed, actual, message, category });
    const event: CheckEvent = {
      time: new Date().toISOString(),
      kind: 'check',
      correlationId: this.correlationId,
      handler,
      inputs: {
        expression: sanitizedInputs.expression as string,
        expected: sanitizedInputs.expected,
      },
      outputs: {
        passed: sanitizedOutputs.passed as boolean,
        actual: sanitizedOutputs.actual,
        message: sanitizedOutputs.message as string | undefined,
        category: sanitizedOutputs.category as 'precondition' | 'postcondition' | 'invariant' | 'temporal' | 'assertion',
      },
      events: [],
      metadata,
    };

    this.events.push(event);
    
    if (this.verbose) {
      console.debug(`[Trace] Check ${category}: ${expression}`, { passed, correlationId: this.correlationId });
    }

    return event;
  }

  /**
   * Emit a nested event (for hierarchical traces)
   */
  emitNested(
    handler: string,
    nestedEvents: TraceEvent[],
    metadata?: Record<string, unknown>
  ): TraceEvent {
    const event: TraceEvent = {
      time: new Date().toISOString(),
      kind: 'nested',
      correlationId: this.correlationId,
      handler,
      inputs: {},
      outputs: {},
      events: nestedEvents,
      metadata,
    };

    this.events.push(event);
    
    if (this.verbose) {
      console.debug(`[Trace] Nested events: ${handler}`, { eventCount: nestedEvents.length, correlationId: this.correlationId });
    }

    return event;
  }

  /**
   * Emit a custom event
   */
  emitCustom(
    kind: TraceEventKind,
    handler: string,
    inputs: Record<string, unknown>,
    outputs: Record<string, unknown>,
    events: TraceEvent[] = [],
    metadata?: Record<string, unknown>
  ): TraceEvent {
    const event: TraceEvent = {
      time: new Date().toISOString(),
      kind,
      correlationId: this.correlationId,
      handler,
      inputs: sanitizeInputs(inputs),
      outputs: sanitizeOutputs(outputs),
      events,
      metadata,
      timing: this.createTiming(),
    };

    this.events.push(event);
    
    if (this.verbose) {
      console.debug(`[Trace] Custom event: ${kind}`, { handler, correlationId: this.correlationId });
    }

    return event;
  }

  // ============================================================================
  // Login-Specific Event Emitters
  // These methods emit events for Login clause verification
  // ============================================================================

  /**
   * Emit a rate limit checked event
   */
  emitRateLimitChecked(
    handler: string,
    identifier: string,
    identifierType: 'ip' | 'user_id' | 'email_hash' | 'fingerprint' | 'other',
    limit: number,
    windowSeconds: number,
    result: {
      allowed: boolean;
      currentCount: number;
      remaining: number;
      resetInSeconds: number;
    },
    metadata?: Record<string, unknown>
  ): RateLimitCheckedEvent {
    const startMs = Date.now();
    
    const event: RateLimitCheckedEvent = {
      time: new Date().toISOString(),
      kind: 'rate_limit_checked',
      correlationId: this.correlationId,
      handler,
      inputs: {
        identifier: '[IDENTIFIER_HASH]', // Always redact the actual identifier
        identifierType,
        limit,
        windowSeconds,
      },
      outputs: {
        allowed: result.allowed,
        currentCount: result.currentCount,
        remaining: result.remaining,
        resetInSeconds: result.resetInSeconds,
        exceeded: !result.allowed,
      },
      events: [],
      metadata,
      timing: this.createTiming(startMs),
    };

    this.events.push(event);
    
    if (this.verbose) {
      console.debug(`[Trace] Rate limit checked: ${result.allowed ? 'allowed' : 'exceeded'}`, {
        handler,
        remaining: result.remaining,
        correlationId: this.correlationId,
      });
    }

    return event;
  }

  /**
   * Emit an audit written event
   */
  emitAuditWritten(
    handler: string,
    action: AuditWrittenEvent['inputs']['action'],
    result: {
      success: boolean;
      auditId: string;
      destination?: 'database' | 'file' | 'external' | 'memory';
    },
    actorId?: string,
    targetId?: string,
    metadata?: Record<string, unknown>
  ): AuditWrittenEvent {
    const startMs = Date.now();
    
    const event: AuditWrittenEvent = {
      time: new Date().toISOString(),
      kind: 'audit_written',
      correlationId: this.correlationId,
      handler,
      inputs: {
        action,
        actorId: actorId ? `user_[REDACTED]` : undefined, // Sanitize actor ID
        targetId: targetId ? `${targetId.split('_')[0]}_[REDACTED]` : undefined, // Sanitize target ID
      },
      outputs: {
        success: result.success,
        auditId: result.auditId,
        timestamp: new Date().toISOString(),
        destination: result.destination || 'database',
      },
      events: [],
      metadata,
      timing: this.createTiming(startMs),
    };

    this.events.push(event);
    
    if (this.verbose) {
      console.debug(`[Trace] Audit written: ${action}`, {
        handler,
        success: result.success,
        correlationId: this.correlationId,
      });
    }

    return event;
  }

  /**
   * Emit a session created event
   */
  emitSessionCreated(
    handler: string,
    userId: string,
    sessionType: SessionCreatedEvent['inputs']['sessionType'],
    result: {
      sessionId: string;
      tokenType?: 'bearer' | 'jwt' | 'opaque';
      expiresAt: string | Date;
      metadata?: {
        userAgent?: string;
        ipCountry?: string;
        deviceType?: string;
      };
    },
    scopes?: string[],
    eventMetadata?: Record<string, unknown>
  ): SessionCreatedEvent {
    const startMs = Date.now();
    
    // Partial mask session ID (show first 4 and last 4 chars)
    const maskedSessionId = result.sessionId.length > 8
      ? `${result.sessionId.substring(0, 4)}****${result.sessionId.substring(result.sessionId.length - 4)}`
      : '[REDACTED]';
    
    const event: SessionCreatedEvent = {
      time: new Date().toISOString(),
      kind: 'session_created',
      correlationId: this.correlationId,
      handler,
      inputs: {
        userId: 'user_[REDACTED]', // Always sanitize user ID
        sessionType,
        scopes,
      },
      outputs: {
        sessionId: maskedSessionId,
        tokenType: result.tokenType,
        expiresAt: result.expiresAt instanceof Date 
          ? result.expiresAt.toISOString() 
          : result.expiresAt,
        metadata: result.metadata,
      },
      events: [],
      metadata: eventMetadata,
      timing: this.createTiming(startMs),
    };

    this.events.push(event);
    
    if (this.verbose) {
      console.debug(`[Trace] Session created: ${sessionType}`, {
        handler,
        expiresAt: event.outputs.expiresAt,
        correlationId: this.correlationId,
      });
    }

    return event;
  }

  /**
   * Emit a user updated event
   */
  emitUserUpdated(
    handler: string,
    userId: string,
    fields: string[],
    reason: UserUpdatedEvent['inputs']['reason'],
    result: {
      success: boolean;
      changedFields?: string[];
    },
    metadata?: Record<string, unknown>
  ): UserUpdatedEvent {
    const startMs = Date.now();
    
    const event: UserUpdatedEvent = {
      time: new Date().toISOString(),
      kind: 'user_updated',
      correlationId: this.correlationId,
      handler,
      inputs: {
        userId: 'user_[REDACTED]', // Always sanitize user ID
        fields,
        reason,
      },
      outputs: {
        success: result.success,
        updatedAt: new Date().toISOString(),
        changedFields: result.changedFields || fields,
      },
      events: [],
      metadata,
      timing: this.createTiming(startMs),
    };

    this.events.push(event);
    
    if (this.verbose) {
      console.debug(`[Trace] User updated: ${reason}`, {
        handler,
        fields,
        success: result.success,
        correlationId: this.correlationId,
      });
    }

    return event;
  }

  /**
   * Emit an error returned event
   */
  emitErrorReturned(
    handler: string,
    error: {
      name: string;
      code?: string;
      message?: string;
    },
    context: string,
    response: {
      statusCode: number;
      errorCode: string;
      message: string;
      errorType: ErrorReturnedEvent['outputs']['errorType'];
      retry?: {
        allowed: boolean;
        afterSeconds?: number;
      };
    },
    metadata?: Record<string, unknown>
  ): ErrorReturnedEvent {
    const startMs = Date.now();
    
    const event: ErrorReturnedEvent = {
      time: new Date().toISOString(),
      kind: 'error_returned',
      correlationId: this.correlationId,
      handler,
      inputs: {
        error: {
          name: error.name,
          code: error.code,
          // Don't include error.message as it might contain PII
        },
        context,
      },
      outputs: {
        statusCode: response.statusCode,
        errorCode: response.errorCode,
        message: response.message, // This should be a safe, user-facing message
        errorType: response.errorType,
        retry: response.retry,
      },
      events: [],
      metadata,
      timing: this.createTiming(startMs),
    };

    this.events.push(event);
    
    if (this.verbose) {
      console.debug(`[Trace] Error returned: ${response.errorCode}`, {
        handler,
        statusCode: response.statusCode,
        errorType: response.errorType,
        correlationId: this.correlationId,
      });
    }

    return event;
  }

  /**
   * Get all events collected so far
   */
  getEvents(): TraceEvent[] {
    return [...this.events];
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
    this.startTime = new Date().toISOString();
    this.startTimeMs = Date.now();
    this.sequenceCounter = 0;
  }

  /**
   * Build a complete trace
   */
  buildTrace(
    name: string,
    metadata?: TraceMetadata
  ): Trace {
    const endTime = new Date().toISOString();
    const startTimeMs = new Date(this.startTime).getTime();
    const endTimeMs = new Date(endTime).getTime();
    const duration = endTimeMs - startTimeMs;

    return {
      id: randomUUID(),
      name,
      domain: this.domain,
      startTime: this.startTime,
      endTime,
      correlationId: this.correlationId,
      events: this.events,
      metadata: {
        ...metadata,
        duration,
      },
    };
  }

  /**
   * Export trace as JSON string
   */
  exportTrace(name: string, metadata?: TraceMetadata): string {
    const trace = this.buildTrace(name, metadata);
    return JSON.stringify(trace, null, 2);
  }
}

/**
 * Create a new trace emitter
 */
export function createTraceEmitter(options?: TraceEmitterOptions): TraceEmitter {
  return new TraceEmitter(options);
}

/**
 * Create a trace emitter with a specific correlation ID
 */
export function createTraceEmitterWithCorrelation(
  correlationId: string,
  options?: Omit<TraceEmitterOptions, 'correlationId'>
): TraceEmitter {
  return new TraceEmitter({
    ...options,
    correlationId,
  });
}
