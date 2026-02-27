// ============================================================================
// Observability Standard Library - Utility Functions
// @isl-lang/stdlib-observability
// ============================================================================

import { UUID, TraceId, SpanId } from './types';

// ============================================================================
// ID Generation
// ============================================================================

declare const crypto: {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
} | undefined;

export function generateUUID(): UUID {
  if (typeof crypto !== 'undefined' && crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateTraceId(): TraceId {
  // Generate 32 hex chars (16 bytes)
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto?.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSpanId(): SpanId {
  // Generate 16 hex chars (8 bytes)
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto?.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================================
// Clock Interface for deterministic timing
// ============================================================================

export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class MockClock implements Clock {
  private currentTime: number;

  constructor(initialTime?: number | Date) {
    this.currentTime = typeof initialTime === 'number' 
      ? initialTime 
      : initialTime?.getTime() 
      || Date.now();
  }

  now(): Date {
    return new Date(this.currentTime);
  }

  advance(ms: number): void {
    this.currentTime += ms;
  }

  setTime(time: number | Date): void {
    this.currentTime = typeof time === 'number' ? time : time.getTime();
  }
}

// Default clock instance
let defaultClock: Clock = new SystemClock();

export function setDefaultClock(clock: Clock): void {
  defaultClock = clock;
}

export function getDefaultClock(): Clock {
  return defaultClock;
}

// ============================================================================
// Time utilities
// ============================================================================

export function now(): Date {
  return defaultClock.now();
}

export function epochMillis(): number {
  return defaultClock.now().getTime();
}

export function duration(startTime: Date, endTime?: Date): number {
  const end = endTime || defaultClock.now();
  return end.getTime() - startTime.getTime();
}

// ============================================================================
// Validation utilities
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
// Error serialization
// ============================================================================

export function serializeError(error: Error): {
  type: string;
  message: string;
  stackTrace?: string;
  name?: string;
  code?: string | number;
} {
  const serialized: any = {
    type: error.constructor.name,
    message: error.message,
  };

  if (error.stack) {
    serialized.stackTrace = error.stack;
  }

  if ('name' in error) {
    serialized.name = error.name;
  }

  if ('code' in error) {
    serialized.code = (error as any).code;
  }

  return serialized;
}

// ============================================================================
// Attribute sanitization
// ============================================================================

export function sanitizeAttributes(attributes?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!attributes) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(attributes)) {
    // Skip null/undefined values
    if (value === null || value === undefined) {
      continue;
    }

    // Convert functions to string representation
    if (typeof value === 'function') {
      sanitized[key] = `[Function: ${value.name || 'anonymous'}]`;
      continue;
    }

    // Handle circular references
    if (typeof value === 'object') {
      try {
        JSON.stringify(value);
        sanitized[key] = value;
      } catch {
        sanitized[key] = '[Circular]';
      }
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

// ============================================================================
// Default export
// ============================================================================

export default {
  generateUUID,
  generateTraceId,
  generateSpanId,
  SystemClock,
  MockClock,
  setDefaultClock,
  getDefaultClock,
  now,
  epochMillis,
  duration,
  isValidTraceId,
  isValidSpanId,
  isValidUUID,
  serializeError,
  sanitizeAttributes,
};
