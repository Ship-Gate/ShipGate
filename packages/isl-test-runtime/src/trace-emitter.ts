/**
 * Trace Emitter for Runtime Verification
 * 
 * Captures inputs/outputs and key events (audit called, rate limit checked)
 * for verification purposes. Emits traces in the format needed for verification.
 * 
 * Security: No PII in traces - sensitive data is redacted.
 */

import type { Trace, TraceEvent, TraceMetadata, EventType } from '@isl-lang/trace-viewer';

// ============================================================================
// Types
// ============================================================================

export interface TraceEmitterOptions {
  /** Test name */
  testName: string;
  /** Domain name */
  domain: string;
  /** Behavior name */
  behavior: string;
  /** Implementation identifier */
  implementation?: string;
  /** Environment */
  environment?: string;
}

export interface EventCapture {
  /** Event type */
  type: EventType;
  /** Event timestamp */
  timestamp: number;
  /** Event data */
  data: Record<string, unknown>;
  /** Function name (if applicable) */
  function?: string;
  /** Caller (if applicable) */
  caller?: string;
}

// ============================================================================
// Trace Emitter
// ============================================================================

export class TraceEmitter {
  private traceId: string;
  private startTime: number;
  private events: TraceEvent[] = [];
  private initialState: Record<string, unknown> = {};
  private options: TraceEmitterOptions;
  private eventCounter = 0;

  constructor(options: TraceEmitterOptions) {
    this.options = options;
    this.traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.startTime = Date.now();
  }

  /**
   * Capture initial state
   */
  captureInitialState(state: Record<string, unknown>): void {
    this.initialState = this.redactPII(state);
  }

  /**
   * Emit a function call event
   */
  emitCall(functionName: string, args: Record<string, unknown>, caller?: string): void {
    this.events.push({
      id: this.generateEventId(),
      type: 'call',
      timestamp: Date.now(),
      data: {
        kind: 'call',
        function: functionName,
        args: this.redactPII(args),
        caller,
      },
    });
  }

  /**
   * Emit a function return event
   */
  emitReturn(functionName: string, result: unknown, duration: number): void {
    this.events.push({
      id: this.generateEventId(),
      type: 'return',
      timestamp: Date.now(),
      data: {
        kind: 'return',
        function: functionName,
        result: this.redactValue(result),
        duration,
      },
    });
  }

  /**
   * Emit a state change event
   */
  emitStateChange(
    path: string[],
    oldValue: unknown,
    newValue: unknown,
    source: string
  ): void {
    this.events.push({
      id: this.generateEventId(),
      type: 'state_change',
      timestamp: Date.now(),
      data: {
        kind: 'state_change',
        path,
        oldValue: this.redactValue(oldValue),
        newValue: this.redactValue(newValue),
        source,
      },
    });
  }

  /**
   * Emit a check event (precondition, postcondition, invariant)
   */
  emitCheck(
    expression: string,
    passed: boolean,
    category: 'precondition' | 'postcondition' | 'invariant' | 'temporal' | 'assertion',
    expected?: unknown,
    actual?: unknown,
    message?: string
  ): void {
    this.events.push({
      id: this.generateEventId(),
      type: category === 'precondition' ? 'precondition' : 
            category === 'postcondition' ? 'postcondition' :
            category === 'invariant' ? 'invariant' :
            category === 'temporal' ? 'temporal' : 'check',
      timestamp: Date.now(),
      data: {
        kind: 'check',
        expression,
        passed,
        expected: this.redactValue(expected),
        actual: this.redactValue(actual),
        message,
        category,
      },
    });
  }

  /**
   * Emit an audit event
   */
  emitAudit(eventType: string, data: Record<string, unknown>): void {
    this.events.push({
      id: this.generateEventId(),
      type: 'check',
      timestamp: Date.now(),
      data: {
        kind: 'check',
        expression: `audit.${eventType}`,
        passed: true,
        category: 'assertion',
        message: `Audit event: ${eventType}`,
        auditData: this.redactPII(data),
      },
    });
  }

  /**
   * Emit a rate limit check event
   */
  emitRateLimitCheck(
    key: string,
    allowed: boolean,
    limit: number,
    current: number,
    retryAfter?: number
  ): void {
    this.events.push({
      id: this.generateEventId(),
      type: 'check',
      timestamp: Date.now(),
      data: {
        kind: 'check',
        expression: 'rate_limit.check',
        passed: allowed,
        category: 'assertion',
        message: allowed 
          ? `Rate limit check passed: ${current}/${limit}`
          : `Rate limit exceeded: ${current}/${limit}`,
        rateLimit: {
          key: this.redactPIIValue(key),
          allowed,
          limit,
          current,
          retryAfter,
        },
      },
    });
  }

  /**
   * Emit an error event
   */
  emitError(message: string, code?: string, stack?: string): void {
    this.events.push({
      id: this.generateEventId(),
      type: 'error',
      timestamp: Date.now(),
      data: {
        kind: 'error',
        message,
        code,
        stack: stack ? this.redactPIIValue(stack) : undefined,
      },
    });
  }

  /**
   * Finalize and return the trace
   */
  finalize(passed: boolean, failureIndex?: number): Trace {
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    const metadata: TraceMetadata = {
      testName: this.options.testName,
      scenario: this.options.behavior,
      implementation: this.options.implementation,
      version: '1.0.0',
      environment: this.options.environment || 'test',
      passed,
      failureIndex,
      duration,
    };

    return {
      id: this.traceId,
      name: `${this.options.testName} - ${this.options.behavior}`,
      domain: this.options.domain,
      startTime: this.startTime,
      endTime,
      events: this.events,
      initialState: this.initialState,
      snapshots: [],
      metadata,
    };
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${this.eventCounter++}_${Date.now()}`;
  }

  /**
   * Redact PII from an object
   */
  private redactPII(obj: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // Skip forbidden keys
      if (this.isForbiddenKey(lowerKey)) {
        continue;
      }

      // Redact based on key patterns
      if (lowerKey.includes('email')) {
        redacted[key] = this.redactEmail(String(value));
      } else if (lowerKey.includes('ip') || lowerKey === 'ip_address') {
        redacted[key] = this.redactIP(String(value));
      } else if (lowerKey.includes('phone')) {
        redacted[key] = this.redactPhone(String(value));
      } else if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          redacted[key] = value.map(item => 
            typeof item === 'object' && item !== null
              ? this.redactPII(item as Record<string, unknown>)
              : this.redactValue(item)
          );
        } else {
          redacted[key] = this.redactPII(value as Record<string, unknown>);
        }
      } else {
        redacted[key] = this.redactValue(value);
      }
    }

    return redacted;
  }

  /**
   * Redact a single value
   */
  private redactValue(value: unknown): unknown {
    if (typeof value === 'string') {
      // Check if it looks like an email
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return this.redactEmail(value);
      }
      // Check if it looks like an IP
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) {
        return this.redactIP(value);
      }
    }
    return value;
  }

  /**
   * Redact PII from a string value
   */
  private redactPIIValue(value: string): string {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return this.redactEmail(value);
    }
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) {
      return this.redactIP(value);
    }
    return value;
  }

  /**
   * Redact email address
   */
  private redactEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***@***';
    const redactedLocal = local.length > 1 
      ? `${local[0]}${'*'.repeat(Math.min(local.length - 1, 3))}`
      : '*';
    return `${redactedLocal}@${domain}`;
  }

  /**
   * Redact IP address
   */
  private redactIP(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    return 'xxx.xxx.xxx.xxx';
  }

  /**
   * Redact phone number
   */
  private redactPhone(phone: string): string {
    if (phone.length > 4) {
      return `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}`;
    }
    return '****';
  }

  /**
   * Check if a key is forbidden (contains sensitive data)
   */
  private isForbiddenKey(key: string): boolean {
    const forbidden = [
      'password',
      'password_hash',
      'secret',
      'api_key',
      'apikey',
      'access_token',
      'accesstoken',
      'refresh_token',
      'refreshtoken',
      'private_key',
      'privatekey',
      'credit_card',
      'creditcard',
      'ssn',
      'social_security',
    ];
    return forbidden.some(f => key.includes(f));
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a new trace emitter
 */
export function createTraceEmitter(options: TraceEmitterOptions): TraceEmitter {
  return new TraceEmitter(options);
}
