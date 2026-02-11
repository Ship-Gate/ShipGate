// ============================================================================
// Observability Standard Library - Correlation Module
// @isl-lang/stdlib-observability
// ============================================================================

import {
  UUID,
  TraceId,
  SpanId,
} from './types';
import {
  generateUUID,
  generateTraceId,
  generateSpanId,
} from './utils';

// ============================================================================
// Correlation Context
// ============================================================================

export interface CorrelationContext {
  traceId?: TraceId;
  spanId?: SpanId;
  correlationId?: UUID;
  requestId?: UUID;
  userId?: string;
  sessionId?: string;
  tenantId?: string;
  version?: string;
  tags?: Record<string, string>;
}

// ============================================================================
// AsyncLocalStorage for context propagation
// ============================================================================

interface AsyncLocalStorage<T> {
  getStore(): T | undefined;
  run<R>(store: T, callback: (...args: any[]) => R, ...args: any[]): R;
  exit<R>(callback: (...args: any[]) => R, ...args: any[]): R;
}

declare const AsyncLocalStorage: {
  new <T>(): AsyncLocalStorage<T>;
} | undefined;

// Use a simple context stack for environments without AsyncLocalStorage
class SimpleContextStack<T> {
  private stack: T[] = [];

  getStore(): T | undefined {
    return this.stack[this.stack.length - 1];
  }

  run<R>(store: T, callback: (...args: any[]) => R, ...args: any[]): R {
    this.stack.push(store);
    try {
      return callback(...args);
    } finally {
      this.stack.pop();
    }
  }

  exit<R>(callback: (...args: any[]) => R, ...args: any[]): R {
    const current = this.stack.pop();
    try {
      return callback(...args);
    } finally {
      if (current !== undefined) {
        this.stack.push(current);
      }
    }
  }
}

// Create context storage
let contextStorage: AsyncLocalStorage<CorrelationContext> | SimpleContextStack<CorrelationContext>;

if (typeof AsyncLocalStorage !== 'undefined') {
  contextStorage = new AsyncLocalStorage<CorrelationContext>();
} else {
  contextStorage = new SimpleContextStack<CorrelationContext>();
}

// ============================================================================
// Context Management
// ============================================================================

const DEFAULT_CONTEXT: CorrelationContext = {};

export function getCorrelationContext(): CorrelationContext {
  const context = contextStorage.getStore();
  return context ? { ...context } : { ...DEFAULT_CONTEXT };
}

export function setCorrelationContext(context: Partial<CorrelationContext>): void {
  const current = contextStorage.getStore() ?? {};
  const updated = { ...current, ...context };
  // Set in the current async context
  contextStorage.enterWith(updated);
}

export function withCorrelationContext<T>(
  context: Partial<CorrelationContext>,
  callback: () => T
): T {
  const current = getCorrelationContext();
  const merged = { ...current, ...context };
  return contextStorage.run(merged, callback);
}

export function withoutCorrelationContext<T>(callback: () => T): T {
  return contextStorage.exit(callback);
}

// ============================================================================
// Context Generation Helpers
// ============================================================================

export function generateCorrelationId(): UUID {
  return generateUUID();
}

export function generateRequestId(): UUID {
  return generateUUID();
}

export function startNewTrace(): CorrelationContext {
  const traceId = generateTraceId();
  const spanId = generateSpanId();
  const correlationId = generateCorrelationId();
  const requestId = generateRequestId();

  return {
    traceId,
    spanId,
    correlationId,
    requestId,
  };
}

// ============================================================================
// Context Extraction/Injection for Headers
// ============================================================================

export interface CorrelationHeaders {
  'x-trace-id'?: string;
  'x-span-id'?: string;
  'x-correlation-id'?: string;
  'x-request-id'?: string;
  'x-user-id'?: string;
  'x-session-id'?: string;
  'x-tenant-id'?: string;
  'x-version'?: string;
}

export function extractCorrelationFromHeaders(headers: Record<string, string>): CorrelationContext {
  const context: CorrelationContext = {};

  if (headers['x-trace-id']) context.traceId = headers['x-trace-id'];
  if (headers['x-span-id']) context.spanId = headers['x-span-id'];
  if (headers['x-correlation-id']) context.correlationId = headers['x-correlation-id'];
  if (headers['x-request-id']) context.requestId = headers['x-request-id'];
  if (headers['x-user-id']) context.userId = headers['x-user-id'];
  if (headers['x-session-id']) context.sessionId = headers['x-session-id'];
  if (headers['x-tenant-id']) context.tenantId = headers['x-tenant-id'];
  if (headers['x-version']) context.version = headers['x-version'];

  return context;
}

export function injectCorrelationIntoHeaders(context: CorrelationContext): CorrelationHeaders {
  const headers: CorrelationHeaders = {};

  if (context.traceId) headers['x-trace-id'] = context.traceId;
  if (context.spanId) headers['x-span-id'] = context.spanId;
  if (context.correlationId) headers['x-correlation-id'] = context.correlationId;
  if (context.requestId) headers['x-request-id'] = context.requestId;
  if (context.userId) headers['x-user-id'] = context.userId;
  if (context.sessionId) headers['x-session-id'] = context.sessionId;
  if (context.tenantId) headers['x-tenant-id'] = context.tenantId;
  if (context.version) headers['x-version'] = context.version;

  return headers;
}

// ============================================================================
// Context Validation
// ============================================================================

export function isValidTraceId(traceId: string): boolean {
  return /^[a-f0-9]{32}$/i.test(traceId);
}

export function isValidSpanId(spanId: string): boolean {
  return /^[a-f0-9]{16}$/i.test(spanId);
}

export function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

// ============================================================================
// Middleware Helpers
// ============================================================================

export type CorrelationMiddleware<Input = any, Output = any> = (
  input: Input,
  next: (input: Input) => Promise<Output> | Output
) => Promise<Output> | Output;

export function createCorrelationMiddleware(
  contextExtractor?: (input: any) => Partial<CorrelationContext>
): CorrelationMiddleware {
  return async (input, next) => {
    // Extract context from input if extractor provided
    let context: Partial<CorrelationContext> = {};
    if (contextExtractor) {
      context = contextExtractor(input) || {};
    }

    // Ensure we have required IDs
    if (!context.traceId) {
      context.traceId = generateTraceId();
    }
    if (!context.spanId) {
      context.spanId = generateSpanId();
    }
    if (!context.correlationId) {
      context.correlationId = generateCorrelationId();
    }
    if (!context.requestId) {
      context.requestId = generateRequestId();
    }

    return withCorrelationContext(context, () => next(input));
  };
}

// ============================================================================
// Default export
// ============================================================================

export default {
  getCorrelationContext,
  setCorrelationContext,
  withCorrelationContext,
  withoutCorrelationContext,
  generateCorrelationId,
  generateRequestId,
  startNewTrace,
  extractCorrelationFromHeaders,
  injectCorrelationIntoHeaders,
  isValidTraceId,
  isValidSpanId,
  isValidUUID,
  createCorrelationMiddleware,
};
