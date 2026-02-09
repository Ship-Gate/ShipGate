/**
 * Trace Parsing and Utilities
 * 
 * Functions for parsing, analyzing, and manipulating verification traces.
 */

import type { 
  Trace, 
  TraceEvent, 
  State, 
  CheckEventData,
  StateChangeEventData,
  EventType,
  ProofBundle,
} from '@/types';

/**
 * Parse a trace from JSON
 */
export function parseTrace(json: string): Trace {
  const data = JSON.parse(json);
  
  // Validate required fields
  if (!data.id || !data.events || !Array.isArray(data.events)) {
    throw new Error('Invalid trace format: missing required fields');
  }

  return {
    id: data.id,
    name: data.name ?? 'Unnamed Trace',
    domain: data.domain ?? 'unknown',
    startTime: data.startTime ?? 0,
    endTime: data.endTime,
    events: data.events.map(normalizeEvent),
    initialState: data.initialState ?? {},
    snapshots: data.snapshots ?? [],
    metadata: {
      testName: data.metadata?.testName,
      scenario: data.metadata?.scenario,
      implementation: data.metadata?.implementation,
      version: data.metadata?.version,
      environment: data.metadata?.environment,
      passed: data.metadata?.passed ?? true,
      failureIndex: data.metadata?.failureIndex,
      duration: data.metadata?.duration ?? 0,
    },
  };
}

/**
 * Parse a proof bundle from JSON
 */
export function parseProofBundle(json: string): ProofBundle {
  const data = JSON.parse(json);
  
  return {
    trace: parseTrace(JSON.stringify(data.trace)),
    contract: data.contract ?? '',
    verificationResult: data.verificationResult ?? {
      passed: true,
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      coverage: 0,
      failures: [],
    },
    generatedAt: data.generatedAt ?? new Date().toISOString(),
  };
}

/**
 * Normalize an event to ensure consistent structure
 */
function normalizeEvent(event: Partial<TraceEvent>, index: number): TraceEvent {
  return {
    id: event.id ?? `event-${index}`,
    type: event.type ?? 'state_change',
    timestamp: event.timestamp ?? index,
    data: event.data ?? { kind: 'state_change', path: [], oldValue: null, newValue: null, source: '' },
    stackFrame: event.stackFrame,
  };
}

/**
 * Compute state at a specific event index
 */
export function computeStateAtIndex(trace: Trace, index: number): State {
  // Start with initial state
  let state = structuredClone(trace.initialState);

  // Apply all state changes up to and including the index
  for (let i = 0; i <= index && i < trace.events.length; i++) {
    const event = trace.events[i];
    if (!event || event.type !== 'state_change' || event.data.kind !== 'state_change') continue;
    {
      const changeData = event.data as StateChangeEventData;
      state = applyStateChange(state, changeData.path, changeData.newValue);
    }
  }

  return state;
}

/**
 * Apply a state change at the given path
 */
function applyStateChange(state: State, path: string[], value: unknown): State {
  if (path.length === 0) return state;

  const newState = structuredClone(state);
  let current: Record<string, unknown> = newState;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (key === undefined) continue;
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = path[path.length - 1];
  if (lastKey !== undefined) current[lastKey] = value;
  return newState;
}

/**
 * Compute diff between two states
 */
export function computeStateDiff(
  oldState: State | null, 
  newState: State
): { path: string[]; oldValue: unknown; newValue: unknown }[] {
  const diffs: { path: string[]; oldValue: unknown; newValue: unknown }[] = [];

  function compare(old: unknown, next: unknown, path: string[]) {
    if (old === next) return;

    if (typeof old !== typeof next || 
        old === null || next === null ||
        typeof old !== 'object' || typeof next !== 'object') {
      diffs.push({ path, oldValue: old, newValue: next });
      return;
    }

    const oldObj = old as Record<string, unknown>;
    const newObj = next as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of allKeys) {
      compare(oldObj[key], newObj[key], [...path, key]);
    }
  }

  compare(oldState ?? {}, newState, []);
  return diffs;
}

/**
 * Find the first failing event
 */
export function findFirstFailure(trace: Trace): number {
  return trace.events.findIndex(
    e => e.type === 'check' && 
    e.data.kind === 'check' && 
    !(e.data as CheckEventData).passed
  );
}

/**
 * Get all failing events
 */
export function getFailures(trace: Trace): TraceEvent[] {
  return trace.events.filter(
    e => e.type === 'check' && 
    e.data.kind === 'check' && 
    !(e.data as CheckEventData).passed
  );
}

/**
 * Filter events by type
 */
export function filterEventsByType(events: TraceEvent[], types: EventType[]): TraceEvent[] {
  if (types.length === 0) return events;
  return events.filter(e => types.includes(e.type));
}

/**
 * Search events by content
 */
export function searchEvents(events: TraceEvent[], query: string): TraceEvent[] {
  if (!query.trim()) return events;
  
  const lower = query.toLowerCase();
  return events.filter(event => {
    const dataStr = JSON.stringify(event.data).toLowerCase();
    return dataStr.includes(lower) || event.type.includes(lower);
  });
}

/**
 * Get call stack at a specific event
 */
export function getCallStackAtIndex(trace: Trace, index: number): string[] {
  const stack: string[] = [];
  
  for (let i = 0; i <= index; i++) {
    const event = trace.events[i];
    if (!event) continue;
    if (event.type === 'call' && event.data.kind === 'call') {
      stack.push(event.data.function);
    } else if (event.type === 'return' && event.data.kind === 'return') {
      const fnName = event.data.function;
      const idx = stack.lastIndexOf(fnName);
      if (idx >= 0) stack.splice(idx, 1);
    }
  }

  return stack;
}

/**
 * Get variables at a specific event
 */
export function getVariablesAtIndex(trace: Trace, index: number): Record<string, unknown> {
  const event = trace.events[index];
  return event?.stackFrame?.variables ?? {};
}

/**
 * Calculate trace statistics
 */
export function getTraceStats(trace: Trace): {
  totalEvents: number;
  byType: Record<EventType, number>;
  passedChecks: number;
  failedChecks: number;
  stateChanges: number;
  duration: number;
} {
  const byType: Record<string, number> = {};
  let passedChecks = 0;
  let failedChecks = 0;
  let stateChanges = 0;

  for (const event of trace.events) {
    byType[event.type] = (byType[event.type] ?? 0) + 1;
    
    if (event.type === 'check' && event.data.kind === 'check') {
      const checkData = event.data as CheckEventData;
      if (checkData.passed) passedChecks++;
      else failedChecks++;
    }
    
    if (event.type === 'state_change') {
      stateChanges++;
    }
  }

  return {
    totalEvents: trace.events.length,
    byType: byType as Record<EventType, number>,
    passedChecks,
    failedChecks,
    stateChanges,
    duration: trace.metadata.duration,
  };
}

/**
 * Export trace to JSON
 */
export function exportTrace(trace: Trace): string {
  return JSON.stringify(trace, null, 2);
}

/**
 * Create a sample trace for demo/testing
 */
export function createSampleTrace(): Trace {
  return {
    id: 'sample-trace-1',
    name: 'User Registration Flow',
    domain: 'UserAuth',
    startTime: Date.now(),
    endTime: Date.now() + 150,
    events: [
      {
        id: 'e1',
        type: 'call',
        timestamp: 0,
        data: { kind: 'call', function: 'registerUser', args: { email: 'user@example.com', password: '***' } },
      },
      {
        id: 'e2',
        type: 'check',
        timestamp: 5,
        data: { kind: 'check', expression: 'email.isValid()', passed: true, category: 'precondition' },
      },
      {
        id: 'e3',
        type: 'state_change',
        timestamp: 10,
        data: { kind: 'state_change', path: ['users', 'pending'], oldValue: [], newValue: ['user@example.com'], source: 'registerUser' },
      },
      {
        id: 'e4',
        type: 'call',
        timestamp: 15,
        data: { kind: 'call', function: 'sendVerificationEmail', args: { email: 'user@example.com' } },
      },
      {
        id: 'e5',
        type: 'return',
        timestamp: 50,
        data: { kind: 'return', function: 'sendVerificationEmail', result: { sent: true }, duration: 35 },
      },
      {
        id: 'e6',
        type: 'check',
        timestamp: 55,
        data: { kind: 'check', expression: 'verificationEmailSent', passed: true, category: 'postcondition' },
      },
      {
        id: 'e7',
        type: 'state_change',
        timestamp: 60,
        data: { kind: 'state_change', path: ['users', 'count'], oldValue: 0, newValue: 1, source: 'registerUser' },
      },
      {
        id: 'e8',
        type: 'check',
        timestamp: 65,
        data: { kind: 'check', expression: 'users.count >= old(users.count)', passed: true, category: 'invariant' },
      },
      {
        id: 'e9',
        type: 'return',
        timestamp: 70,
        data: { kind: 'return', function: 'registerUser', result: { success: true, userId: 'u123' }, duration: 70 },
      },
      {
        id: 'e10',
        type: 'check',
        timestamp: 75,
        data: { kind: 'check', expression: 'result.userId != null', passed: true, category: 'postcondition' },
      },
    ],
    initialState: {
      users: { count: 0, pending: [], verified: [] },
      config: { maxUsers: 1000, requireVerification: true },
    },
    snapshots: [],
    metadata: {
      testName: 'test_user_registration',
      scenario: 'happy_path',
      implementation: 'auth-service',
      version: '1.0.0',
      passed: true,
      duration: 75,
    },
  };
}

/**
 * Create a failing sample trace
 */
export function createFailingSampleTrace(): Trace {
  return {
    id: 'sample-trace-fail',
    name: 'Payment Processing (Failed)',
    domain: 'Payments',
    startTime: Date.now(),
    endTime: Date.now() + 100,
    events: [
      {
        id: 'e1',
        type: 'call',
        timestamp: 0,
        data: { kind: 'call', function: 'processPayment', args: { amount: 150, currency: 'USD' } },
      },
      {
        id: 'e2',
        type: 'check',
        timestamp: 5,
        data: { kind: 'check', expression: 'amount > 0', passed: true, category: 'precondition' },
      },
      {
        id: 'e3',
        type: 'state_change',
        timestamp: 10,
        data: { kind: 'state_change', path: ['balance'], oldValue: 100, newValue: -50, source: 'processPayment' },
      },
      {
        id: 'e4',
        type: 'check',
        timestamp: 15,
        data: { 
          kind: 'check', 
          expression: 'balance >= 0', 
          passed: false, 
          expected: '>= 0',
          actual: -50,
          message: 'Balance cannot be negative',
          category: 'invariant' 
        },
      },
      {
        id: 'e5',
        type: 'error',
        timestamp: 20,
        data: { kind: 'error', message: 'Invariant violation: balance >= 0', code: 'INV_001' },
      },
    ],
    initialState: {
      balance: 100,
      transactions: [],
    },
    snapshots: [],
    metadata: {
      testName: 'test_payment_processing',
      scenario: 'overdraft',
      implementation: 'payment-service',
      version: '1.0.0',
      passed: false,
      failureIndex: 3,
      duration: 20,
    },
  };
}
