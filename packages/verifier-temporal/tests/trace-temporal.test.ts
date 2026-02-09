/**
 * Tests for Temporal Trace Verification
 * 
 * Tests the trace-based temporal verification including:
 * - Temporal trace model (always, eventually, never, within)
 * - Trace-timing integration (verifyAlwaysFromTraces, verifyNeverFromTraces)
 * - Chaos and PBT integration
 */

import { describe, it, expect } from 'vitest';
import type { Trace, TraceEvent } from '@isl-lang/trace-format';
import {
  buildTemporalTrace,
  evaluateAlways,
  evaluateEventually,
  evaluateNever,
  evaluateWithin,
  evaluateLeadsTo,
  type TemporalTrace,
  type StateSnapshot,
} from '../src/trace-model.js';
import {
  verifyAlwaysFromTraces,
  verifyNeverFromTraces,
  verifyTemporalClauses,
} from '../src/trace-timing.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestTrace(events: Partial<TraceEvent>[]): Trace {
  const startTime = new Date('2024-01-01T00:00:00Z');
  return {
    id: 'test-trace',
    name: 'Test Trace',
    domain: 'test',
    startTime: startTime.toISOString(),
    correlationId: 'test-corr',
    events: events.map((e, i) => ({
      time: new Date(startTime.getTime() + (e.timing?.startMs ?? i * 100)).toISOString(),
      kind: e.kind ?? 'handler_call',
      correlationId: `event-${i}`,
      handler: e.handler ?? 'testHandler',
      inputs: e.inputs ?? {},
      outputs: e.outputs ?? {},
      events: e.events ?? [],
      timing: e.timing ?? { startMs: i * 100, durationMs: 50 },
      metadata: e.metadata,
    })),
    initialState: { counter: 0 },
  };
}

function createSimpleTemporalTrace(snapshots: Array<{ state?: Record<string, unknown>; timestampMs?: number; causingEvent?: TraceEvent }>): TemporalTrace {
  const baseTime = new Date('2024-01-01T00:00:00Z');
  return {
    id: 'test-temporal-trace',
    domain: 'test',
    snapshots: snapshots.map((s, i) => ({
      sequence: i,
      timestampMs: s.timestampMs ?? i * 100,
      absoluteTime: new Date(baseTime.getTime() + (s.timestampMs ?? i * 100)).toISOString(),
      state: s.state ?? {},
      causingEvent: s.causingEvent,
    })),
    durationMs: snapshots.length * 100,
    initialState: {},
    finalState: snapshots[snapshots.length - 1]?.state ?? {},
    events: [],
  };
}

// ============================================================================
// TRACE MODEL TESTS
// ============================================================================

describe('Temporal Trace Model', () => {
  describe('buildTemporalTrace', () => {
    it('should build temporal trace from raw trace', () => {
      const trace = createTestTrace([
        { kind: 'handler_call', handler: 'login' },
        { kind: 'handler_return', handler: 'login', outputs: { success: true } },
      ]);

      const temporalTrace = buildTemporalTrace(trace);

      expect(temporalTrace.id).toBe('test-trace');
      expect(temporalTrace.domain).toBe('test');
      expect(temporalTrace.snapshots.length).toBeGreaterThan(0);
    });

    it('should capture state changes from events', () => {
      const trace = createTestTrace([
        {
          kind: 'state_change',
          inputs: { path: ['user', 'loggedIn'], oldValue: false },
          outputs: { newValue: true },
          timing: { startMs: 100, durationMs: 10 },
        },
      ]);

      const temporalTrace = buildTemporalTrace(trace);
      // Verify snapshot captures state change event
      const snapshot = temporalTrace.snapshots.find(s => s.causingEvent?.kind === 'state_change');

      expect(snapshot).toBeDefined();
      expect(snapshot?.causingEvent?.inputs?.path).toEqual(['user', 'loggedIn']);
    });
  });

  describe('evaluateAlways', () => {
    it('should return satisfied when predicate holds for all snapshots', () => {
      const trace = createSimpleTemporalTrace([
        { state: { value: 10 }, timestampMs: 0 },
        { state: { value: 20 }, timestampMs: 100 },
        { state: { value: 30 }, timestampMs: 200 },
      ]);

      const result = evaluateAlways(
        trace,
        (state) => (state.value as number) > 0,
        { description: 'value always positive' }
      );

      expect(result.satisfied).toBe(true);
      expect(result.verdict).toBe('SATISFIED');
      expect(result.snapshotsEvaluated).toBe(3);
    });

    it('should return violated when predicate fails', () => {
      const trace = createSimpleTemporalTrace([
        { state: { value: 10 }, timestampMs: 0 },
        { state: { value: -5 }, timestampMs: 100 },
        { state: { value: 20 }, timestampMs: 200 },
      ]);

      const result = evaluateAlways(
        trace,
        (state) => (state.value as number) >= 0,
        { description: 'value always non-negative' }
      );

      expect(result.satisfied).toBe(false);
      expect(result.verdict).toBe('VIOLATED');
      expect(result.violationIndex).toBe(1);
      expect(result.witnessTimeMs).toBe(100);
    });

    it('should handle empty trace', () => {
      const trace = createSimpleTemporalTrace([]);

      const result = evaluateAlways(
        trace,
        () => true,
        { description: 'trivial' }
      );

      // Empty trace - vacuously true or insufficient data
      expect(result.snapshotsEvaluated).toBe(0);
    });
  });

  describe('evaluateEventually', () => {
    it('should return satisfied when predicate eventually holds', () => {
      const trace = createSimpleTemporalTrace([
        { state: { ready: false }, timestampMs: 0 },
        { state: { ready: false }, timestampMs: 100 },
        { state: { ready: true }, timestampMs: 200 },
      ]);

      const result = evaluateEventually(
        trace,
        (state) => state.ready === true,
        { description: 'eventually ready' }
      );

      expect(result.satisfied).toBe(true);
      expect(result.verdict).toBe('SATISFIED');
      expect(result.witnessTimeMs).toBe(200);
    });

    it('should return not satisfied when predicate never holds', () => {
      const trace = createSimpleTemporalTrace([
        { state: { ready: false }, timestampMs: 0 },
        { state: { ready: false }, timestampMs: 100 },
        { state: { ready: false }, timestampMs: 200 },
      ]);

      const result = evaluateEventually(
        trace,
        (state) => state.ready === true,
        { description: 'eventually ready' }
      );

      expect(result.satisfied).toBe(false);
    });

    it('should respect time bound', () => {
      const trace = createSimpleTemporalTrace([
        { state: { ready: false }, timestampMs: 0 },
        { state: { ready: false }, timestampMs: 100 },
        { state: { ready: true }, timestampMs: 500 },
      ]);

      const result = evaluateEventually(
        trace,
        (state) => state.ready === true,
        { description: 'eventually ready within 200ms', boundMs: 200 }
      );

      expect(result.satisfied).toBe(false);
    });
  });

  describe('evaluateNever', () => {
    it('should return satisfied when forbidden condition never occurs', () => {
      const trace = createSimpleTemporalTrace([
        { state: { error: false }, timestampMs: 0 },
        { state: { error: false }, timestampMs: 100 },
        { state: { error: false }, timestampMs: 200 },
      ]);

      const result = evaluateNever(
        trace,
        (state) => state.error === true,
        { description: 'never error' }
      );

      expect(result.satisfied).toBe(true);
      expect(result.verdict).toBe('SATISFIED');
    });

    it('should return violated when forbidden condition occurs', () => {
      const trace = createSimpleTemporalTrace([
        { state: { error: false }, timestampMs: 0 },
        { state: { error: true }, timestampMs: 100 },
        { state: { error: false }, timestampMs: 200 },
      ]);

      const result = evaluateNever(
        trace,
        (state) => state.error === true,
        { description: 'never error' }
      );

      expect(result.satisfied).toBe(false);
      expect(result.verdict).toBe('VIOLATED');
      expect(result.violationIndex).toBe(1);
    });
  });

  describe('evaluateWithin', () => {
    it('should return satisfied when event occurs within bound', () => {
      const trace = createSimpleTemporalTrace([
        { state: { done: false }, timestampMs: 0, causingEvent: { kind: 'handler_call' } as TraceEvent },
        { state: { done: true }, timestampMs: 50, causingEvent: { kind: 'task_complete' } as TraceEvent },
      ]);

      const result = evaluateWithin(
        trace,
        'task_complete',
        100,
        { description: 'task complete within 100ms' }
      );

      expect(result.satisfied).toBe(true);
    });

    it('should return not satisfied when event does not occur within bound', () => {
      const trace = createSimpleTemporalTrace([
        { state: { done: false }, timestampMs: 0, causingEvent: { kind: 'handler_call' } as TraceEvent },
        { state: { done: true }, timestampMs: 150, causingEvent: { kind: 'task_complete' } as TraceEvent },
      ]);

      const result = evaluateWithin(
        trace,
        'task_complete',
        100,
        { description: 'task complete within 100ms' }
      );

      expect(result.satisfied).toBe(false);
    });
  });

  describe('evaluateLeadsTo', () => {
    it('should return satisfied when trigger leads to response', () => {
      const trace = createSimpleTemporalTrace([
        { state: { request: true, response: false }, timestampMs: 0 },
        { state: { request: false, response: true }, timestampMs: 50 },
        { state: { request: false, response: false }, timestampMs: 100 },
      ]);

      const result = evaluateLeadsTo(
        trace,
        (state) => state.request === true,
        (state) => state.response === true,
        { description: 'request leads to response' }
      );

      expect(result.satisfied).toBe(true);
    });

    it('should return not satisfied when response timeout', () => {
      const trace = createSimpleTemporalTrace([
        { state: { request: true, response: false }, timestampMs: 0 },
        { state: { request: false, response: false }, timestampMs: 200 },
        { state: { request: false, response: true }, timestampMs: 500 },
      ]);

      const result = evaluateLeadsTo(
        trace,
        (state) => state.request === true,
        (state) => state.response === true,
        { description: 'request leads to response', responseWindowMs: 100 }
      );

      expect(result.satisfied).toBe(false);
    });
  });
});

// ============================================================================
// TRACE TIMING INTEGRATION TESTS
// ============================================================================

describe('Trace Timing Integration', () => {
  describe('verifyAlwaysFromTraces', () => {
    it('should verify always property across traces', () => {
      const traces = [
        createTestTrace([
          { kind: 'handler_call', handler: 'op1' },
          { kind: 'handler_return', handler: 'op1' },
        ]),
        createTestTrace([
          { kind: 'handler_call', handler: 'op2' },
          { kind: 'handler_return', handler: 'op2' },
        ]),
      ];

      const result = verifyAlwaysFromTraces(traces, undefined, 'no errors', {});

      expect(result.success).toBe(true);
      expect(result.verdict).toBe('PROVEN');
      expect(result.tracesChecked).toBe(2);
    });

    it('should detect violations across traces', () => {
      const traces = [
        createTestTrace([
          { kind: 'handler_call', handler: 'op1' },
          { kind: 'handler_error', handler: 'op1', outputs: { error: { code: 'ERR' } } },
        ]),
      ];

      const result = verifyAlwaysFromTraces(traces, 'handler_error', 'no handler errors', {});

      expect(result.success).toBe(false);
      expect(result.verdict).toBe('NOT_PROVEN');
    });

    it('should handle empty traces', () => {
      const result = verifyAlwaysFromTraces([], undefined, 'test', {});

      expect(result.success).toBe(false);
      expect(result.verdict).toBe('INCOMPLETE_PROOF');
      expect(result.error).toContain('No traces');
    });
  });

  describe('verifyNeverFromTraces', () => {
    it('should verify never property when event absent', () => {
      const traces = [
        createTestTrace([
          { kind: 'handler_call', handler: 'safe_op' },
          { kind: 'handler_return', handler: 'safe_op' },
        ]),
      ];

      const result = verifyNeverFromTraces(traces, 'handler_error', 'no errors', {});

      expect(result.success).toBe(true);
      expect(result.verdict).toBe('PROVEN');
    });

    it('should detect occurrence of forbidden event', () => {
      const traces = [
        createTestTrace([
          { kind: 'handler_call', handler: 'risky_op' },
          { kind: 'handler_error', handler: 'risky_op' },
        ]),
      ];

      const result = verifyNeverFromTraces(traces, 'handler_error', 'no errors', {});

      expect(result.success).toBe(false);
      expect(result.verdict).toBe('NOT_PROVEN');
    });

    it('should require eventKind', () => {
      const traces = [createTestTrace([])];
      const result = verifyNeverFromTraces(traces, undefined, 'test', {});

      expect(result.success).toBe(false);
      expect(result.verdict).toBe('UNKNOWN');
      expect(result.error).toContain('required');
    });
  });

  describe('verifyTemporalClauses', () => {
    it('should verify multiple clause types', () => {
      const traces = [
        createTestTrace([
          { kind: 'handler_call', handler: 'op', timing: { startMs: 0, durationMs: 50 } },
          { kind: 'handler_return', handler: 'op', timing: { startMs: 50, durationMs: 0 } },
        ]),
      ];

      const clauses = [
        { id: 'c1', type: 'always' as const, text: 'no errors' },
        { id: 'c2', type: 'never' as const, text: 'no failures', eventKind: 'handler_error' },
      ];

      const results = verifyTemporalClauses(traces, clauses, {});

      expect(results.length).toBe(2);
      expect(results[0]?.clauseId).toBe('c1');
      expect(results[1]?.clauseId).toBe('c2');
    });

    it('should handle within clauses', () => {
      const traces = [
        createTestTrace([
          { kind: 'handler_call', handler: 'op', timing: { startMs: 0, durationMs: 50 } },
          { kind: 'handler_return', handler: 'op', timing: { startMs: 50, durationMs: 0 } },
        ]),
      ];

      const clauses = [
        { id: 'c1', type: 'within' as const, text: 'fast response', thresholdMs: 100, eventKind: 'handler_return' },
      ];

      const results = verifyTemporalClauses(traces, clauses, {});

      // Within verification checks timing - result depends on implementation
      expect(results[0]?.clauseId).toBe('c1');
      expect(results[0]?.type).toBe('within');
    });
  });
});

// ============================================================================
// CONFIDENCE CALCULATION TESTS
// ============================================================================

describe('Confidence Calculation', () => {
  it('should increase confidence with more snapshots', () => {
    const smallTrace = createSimpleTemporalTrace([
      { state: { ok: true }, timestampMs: 0 },
    ]);

    const largeTrace = createSimpleTemporalTrace(
      Array.from({ length: 100 }, (_, i) => ({
        state: { ok: true },
        timestampMs: i * 10,
      }))
    );

    const predicate = (state: Record<string, unknown>) => Boolean(state.ok);
    const smallResult = evaluateAlways(smallTrace, predicate, { description: 'test' });
    const largeResult = evaluateAlways(largeTrace, predicate, { description: 'test' });

    expect(largeResult.confidence).toBeGreaterThan(smallResult.confidence);
  });
});
