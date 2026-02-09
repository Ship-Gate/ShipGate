/**
 * Test Traces for Temporal Verification
 * 
 * Sample traces for testing temporal sequence verification.
 * 
 * @module @isl-lang/verifier-temporal/test-traces
 */

import type { Trace, TraceEvent } from '@isl-lang/trace-format';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a trace event
 */
function createEvent(
  kind: TraceEvent['kind'],
  handler: string,
  time: string,
  correlationId: string = 'test-1',
  inputs: Record<string, unknown> = {},
  outputs: Record<string, unknown> = {}
): TraceEvent {
  return {
    time,
    kind,
    correlationId,
    handler,
    inputs,
    outputs,
    events: [],
  };
}

/**
 * Create a trace with events
 */
function createTrace(
  id: string,
  domain: string,
  startTime: string,
  events: TraceEvent[]
): Trace {
  return {
    id,
    name: `Test trace for ${domain}`,
    domain,
    startTime,
    correlationId: events[0]?.correlationId || 'test-1',
    events,
  };
}

// ============================================================================
// SAMPLE TRACES
// ============================================================================

/**
 * Login flow trace - demonstrates "before" rule
 * Sequence: authenticate -> authorize -> create_session
 */
export function createLoginTrace(): Trace {
  const startTime = '2024-01-01T10:00:00.000Z';
  const events: TraceEvent[] = [
    createEvent('handler_call', 'authenticate', '2024-01-01T10:00:00.100Z', 'login-1', {
      username: 'user1',
      password: '***',
    }, {
      userId: '123',
      authenticated: true,
    }),
    createEvent('handler_call', 'authorize', '2024-01-01T10:00:00.200Z', 'login-1', {
      userId: '123',
    }, {
      authorized: true,
      roles: ['user'],
    }),
    createEvent('handler_call', 'create_session', '2024-01-01T10:00:00.300Z', 'login-1', {
      userId: '123',
    }, {
      sessionId: 'session-abc',
    }),
  ];
  
  return createTrace('login-trace-1', 'auth', startTime, events);
}

/**
 * Login flow trace with violation - authorize happens before authenticate
 */
export function createLoginTraceViolation(): Trace {
  const startTime = '2024-01-01T10:00:00.000Z';
  const events: TraceEvent[] = [
    createEvent('handler_call', 'authorize', '2024-01-01T10:00:00.100Z', 'login-2', {
      userId: '123',
    }, {
      authorized: true,
    }),
    createEvent('handler_call', 'authenticate', '2024-01-01T10:00:00.200Z', 'login-2', {
      username: 'user1',
      password: '***',
    }, {
      userId: '123',
      authenticated: true,
    }),
  ];
  
  return createTrace('login-trace-violation', 'auth', startTime, events);
}

/**
 * Rate limit trace - demonstrates "cooldown" rule
 * Multiple requests within cooldown period
 */
export function createRateLimitTrace(): Trace {
  const startTime = '2024-01-01T10:00:00.000Z';
  const events: TraceEvent[] = [
    createEvent('handler_call', 'api_request', '2024-01-01T10:00:00.100Z', 'req-1', {
      endpoint: '/api/data',
    }, {
      data: { result: 'ok' },
    }),
    createEvent('handler_call', 'api_request', '2024-01-01T10:00:00.150Z', 'req-2', {
      endpoint: '/api/data',
    }, {
      data: { result: 'ok' },
    }),
    createEvent('handler_call', 'api_request', '2024-01-01T10:00:01.200Z', 'req-3', {
      endpoint: '/api/data',
    }, {
      data: { result: 'ok' },
    }),
  ];
  
  return createTrace('rate-limit-trace', 'api', startTime, events);
}

/**
 * Rate limit trace with cooldown respected
 */
export function createRateLimitTraceRespected(): Trace {
  const startTime = '2024-01-01T10:00:00.000Z';
  const events: TraceEvent[] = [
    createEvent('handler_call', 'api_request', '2024-01-01T10:00:00.100Z', 'req-1', {
      endpoint: '/api/data',
    }, {
      data: { result: 'ok' },
    }),
    createEvent('handler_call', 'api_request', '2024-01-01T10:00:01.200Z', 'req-2', {
      endpoint: '/api/data',
    }, {
      data: { result: 'ok' },
    }),
    createEvent('handler_call', 'api_request', '2024-01-01T10:00:02.300Z', 'req-3', {
      endpoint: '/api/data',
    }, {
      data: { result: 'ok' },
    }),
  ];
  
  return createTrace('rate-limit-trace-respected', 'api', startTime, events);
}

/**
 * Retry trace - demonstrates "retry" rule
 * Failed request followed by successful retry
 */
export function createRetryTrace(): Trace {
  const startTime = '2024-01-01T10:00:00.000Z';
  const events: TraceEvent[] = [
    createEvent('handler_call', 'process_payment', '2024-01-01T10:00:00.100Z', 'payment-1', {
      amount: 100,
      currency: 'USD',
    }, {
      error: 'Network timeout',
      failed: true,
    }),
    createEvent('handler_error', 'process_payment', '2024-01-01T10:00:00.150Z', 'payment-1', {
      amount: 100,
      currency: 'USD',
    }, {
      error: 'Network timeout',
    }),
    createEvent('handler_call', 'process_payment', '2024-01-01T10:00:00.500Z', 'payment-1', {
      amount: 100,
      currency: 'USD',
    }, {
      transactionId: 'txn-123',
      success: true,
    }),
  ];
  
  return createTrace('retry-trace', 'payment', startTime, events);
}

/**
 * Retry trace with violation - no retry after failure
 */
export function createRetryTraceViolation(): Trace {
  const startTime = '2024-01-01T10:00:00.000Z';
  const events: TraceEvent[] = [
    createEvent('handler_call', 'process_payment', '2024-01-01T10:00:00.100Z', 'payment-2', {
      amount: 100,
      currency: 'USD',
    }, {
      error: 'Network timeout',
      failed: true,
    }),
    createEvent('handler_error', 'process_payment', '2024-01-01T10:00:00.150Z', 'payment-2', {
      amount: 100,
      currency: 'USD',
    }, {
      error: 'Network timeout',
    }),
    // No retry within window
  ];
  
  return createTrace('retry-trace-violation', 'payment', startTime, events);
}

/**
 * Time window trace - demonstrates "time window" rule
 * Event occurs within specified window
 */
export function createTimeWindowTrace(): Trace {
  const startTime = '2024-01-01T10:00:00.000Z';
  const events: TraceEvent[] = [
    createEvent('handler_call', 'scheduled_task', '2024-01-01T10:00:00.500Z', 'task-1', {
      taskId: 'task-123',
    }, {
      completed: true,
    }),
  ];
  
  return createTrace('time-window-trace', 'scheduler', startTime, events);
}

/**
 * Time window trace with violation - event occurs outside window
 */
export function createTimeWindowTraceViolation(): Trace {
  const startTime = '2024-01-01T10:00:00.000Z';
  const events: TraceEvent[] = [
    createEvent('handler_call', 'scheduled_task', '2024-01-01T10:00:02.000Z', 'task-2', {
      taskId: 'task-456',
    }, {
      completed: true,
    }),
  ];
  
  return createTrace('time-window-trace-violation', 'scheduler', startTime, events);
}

/**
 * Complex trace with multiple sequence patterns
 */
export function createComplexTrace(): Trace {
  const startTime = '2024-01-01T10:00:00.000Z';
  const events: TraceEvent[] = [
    // Login sequence
    createEvent('handler_call', 'authenticate', '2024-01-01T10:00:00.100Z', 'complex-1', {
      username: 'user1',
    }, {
      userId: '123',
    }),
    createEvent('handler_call', 'authorize', '2024-01-01T10:00:00.200Z', 'complex-1', {
      userId: '123',
    }, {
      authorized: true,
    }),
    createEvent('handler_call', 'create_session', '2024-01-01T10:00:00.300Z', 'complex-1', {
      userId: '123',
    }, {
      sessionId: 'session-xyz',
    }),
    
    // API request with cooldown
    createEvent('handler_call', 'api_request', '2024-01-01T10:00:01.000Z', 'complex-1', {
      endpoint: '/api/data',
    }, {
      data: { result: 'ok' },
    }),
    createEvent('handler_call', 'api_request', '2024-01-01T10:00:02.000Z', 'complex-1', {
      endpoint: '/api/data',
    }, {
      data: { result: 'ok' },
    }),
    
    // Payment with retry
    createEvent('handler_call', 'process_payment', '2024-01-01T10:00:03.000Z', 'complex-1', {
      amount: 50,
    }, {
      error: 'Temporary failure',
      failed: true,
    }),
    createEvent('handler_call', 'process_payment', '2024-01-01T10:00:03.200Z', 'complex-1', {
      amount: 50,
    }, {
      transactionId: 'txn-789',
      success: true,
    }),
  ];
  
  return createTrace('complex-trace', 'multi-domain', startTime, events);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const testTraces = {
  login: createLoginTrace(),
  loginViolation: createLoginTraceViolation(),
  rateLimit: createRateLimitTrace(),
  rateLimitRespected: createRateLimitTraceRespected(),
  retry: createRetryTrace(),
  retryViolation: createRetryTraceViolation(),
  timeWindow: createTimeWindowTrace(),
  timeWindowViolation: createTimeWindowTraceViolation(),
  complex: createComplexTrace(),
};
