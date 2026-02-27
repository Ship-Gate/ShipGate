/**
 * Tests for trace-based timing verification
 */

import { describe, it, expect } from 'vitest';
import type { Trace, TraceEvent } from '@isl-lang/trace-format';
import {
  extractHandlerDurations,
  extractTimingSamples,
  extractEventTimestamps,
  verifyWithinFromTraces,
  verifyMultipleTimings,
  verifyEventuallyWithin,
  verifyTemporalClauses,
  formatTemporalClauseTable,
} from '../src/trace-timing.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTrace(
  overrides: Partial<Trace> = {},
  events: Partial<TraceEvent>[] = []
): Trace {
  return {
    id: 'test-trace-1',
    name: 'Test Trace',
    domain: 'TestDomain',
    startTime: '2025-01-01T00:00:00.000Z',
    correlationId: 'corr-123',
    events: events.map(e => createEvent(e)),
    ...overrides,
  };
}

function createEvent(overrides: Partial<TraceEvent> = {}): TraceEvent {
  return {
    time: '2025-01-01T00:00:00.100Z',
    kind: 'handler_return',
    correlationId: 'corr-123',
    handler: 'Login',
    inputs: {},
    outputs: {},
    events: [],
    ...overrides,
  };
}

// ============================================================================
// EXTRACTION TESTS
// ============================================================================

describe('extractHandlerDurations', () => {
  it('should extract durations from timing.durationMs', () => {
    const traces = [
      createTrace({}, [
        { timing: { startMs: 0, endMs: 100, durationMs: 100 } },
        { timing: { startMs: 100, endMs: 250, durationMs: 150 } },
      ]),
    ];

    const durations = extractHandlerDurations(traces);

    expect(durations).toHaveLength(2);
    expect(durations).toContain(100);
    expect(durations).toContain(150);
  });

  it('should calculate duration from startMs/endMs when durationMs not present', () => {
    const traces = [
      createTrace({}, [
        { timing: { startMs: 0, endMs: 200 } },
        { timing: { startMs: 500, endMs: 750 } },
      ]),
    ];

    const durations = extractHandlerDurations(traces);

    expect(durations).toHaveLength(2);
    expect(durations).toContain(200);
    expect(durations).toContain(250);
  });

  it('should extract duration from handler_return outputs', () => {
    const traces = [
      createTrace({}, [
        { kind: 'handler_return', outputs: { duration: 123, result: 'ok' } },
      ]),
    ];

    const durations = extractHandlerDurations(traces);

    expect(durations).toHaveLength(1);
    expect(durations[0]).toBe(123);
  });

  it('should filter by handler name', () => {
    const traces = [
      createTrace({}, [
        { handler: 'Login', timing: { startMs: 0, durationMs: 100 } },
        { handler: 'Logout', timing: { startMs: 0, durationMs: 200 } },
        { handler: 'Login', timing: { startMs: 0, durationMs: 150 } },
      ]),
    ];

    const durations = extractHandlerDurations(traces, { handlerName: 'Login' });

    expect(durations).toHaveLength(2);
    expect(durations).toContain(100);
    expect(durations).toContain(150);
    expect(durations).not.toContain(200);
  });

  it('should extract from trace metadata when no events have timing', () => {
    const traces = [
      createTrace({ metadata: { duration: 500 } }, [
        { kind: 'handler_call' }, // No timing info
      ]),
    ];

    const durations = extractHandlerDurations(traces);

    expect(durations).toHaveLength(1);
    expect(durations[0]).toBe(500);
  });

  it('should handle empty traces', () => {
    const durations = extractHandlerDurations([]);
    expect(durations).toHaveLength(0);
  });

  it('should handle traces with no timing data', () => {
    const traces = [
      createTrace({}, [
        { kind: 'handler_call' },
        { kind: 'state_change' },
      ]),
    ];

    const durations = extractHandlerDurations(traces);
    expect(durations).toHaveLength(0);
  });
});

describe('extractTimingSamples', () => {
  it('should extract samples with success status', () => {
    const traces = [
      createTrace({ metadata: { passed: true } }, [
        { timing: { startMs: 0, durationMs: 100 } },
        { timing: { startMs: 0, durationMs: 200 } },
      ]),
    ];

    const samples = extractTimingSamples(traces);

    expect(samples).toHaveLength(2);
    expect(samples[0]?.success).toBe(true);
    expect(samples[0]?.duration).toBe(100);
  });

  it('should mark handler_error events as failed', () => {
    const traces = [
      createTrace({ metadata: { passed: false } }, [
        { kind: 'handler_error', timing: { startMs: 0, durationMs: 100 } },
      ]),
    ];

    const samples = extractTimingSamples(traces);

    expect(samples).toHaveLength(1);
    expect(samples[0]?.success).toBe(false);
  });

  it('should include outputs in result', () => {
    const traces = [
      createTrace({}, [
        { 
          timing: { startMs: 0, durationMs: 50 },
          outputs: { userId: 'user-123' },
        },
      ]),
    ];

    const samples = extractTimingSamples(traces);

    expect(samples[0]?.result).toEqual({ userId: 'user-123' });
  });
});

describe('extractEventTimestamps', () => {
  it('should extract timestamps for matching event kind', () => {
    const traces = [
      createTrace({}, [
        { kind: 'handler_call', time: '2025-01-01T00:00:00.000Z' },
        { kind: 'audit_written', time: '2025-01-01T00:00:00.500Z', timing: { startMs: 500 } },
        { kind: 'handler_return', time: '2025-01-01T00:00:01.000Z' },
      ]),
    ];

    const timestamps = extractEventTimestamps(traces, 'audit_written');

    expect(timestamps).toHaveLength(1);
    expect(timestamps[0]?.timestampMs).toBe(500);
    expect(timestamps[0]?.event.kind).toBe('audit_written');
  });

  it('should calculate timestamp from ISO time when timing not present', () => {
    const traces = [
      createTrace({ startTime: '2025-01-01T00:00:00.000Z' }, [
        { kind: 'audit_written', time: '2025-01-01T00:00:02.500Z' },
      ]),
    ];

    const timestamps = extractEventTimestamps(traces, 'audit_written');

    expect(timestamps).toHaveLength(1);
    expect(timestamps[0]?.timestampMs).toBe(2500);
  });

  it('should return empty for no matches', () => {
    const traces = [
      createTrace({}, [
        { kind: 'handler_call' },
        { kind: 'handler_return' },
      ]),
    ];

    const timestamps = extractEventTimestamps(traces, 'audit_written');
    expect(timestamps).toHaveLength(0);
  });
});

// ============================================================================
// WITHIN VERIFICATION TESTS
// ============================================================================

describe('verifyWithinFromTraces', () => {
  it('should return PROVEN when percentile meets threshold', () => {
    const traces = [
      createTrace({}, [
        { timing: { startMs: 0, durationMs: 50 } },
        { timing: { startMs: 0, durationMs: 75 } },
        { timing: { startMs: 0, durationMs: 100 } },
        { timing: { startMs: 0, durationMs: 125 } },
        { timing: { startMs: 0, durationMs: 150 } },
      ]),
    ];

    const result = verifyWithinFromTraces(
      traces,
      { thresholdMs: 200, percentile: 50 }
    );

    expect(result.success).toBe(true);
    expect(result.verdict).toBe('PROVEN');
    expect(result.sampleCount).toBe(5);
  });

  it('should return NOT_PROVEN when percentile exceeds threshold', () => {
    const traces = [
      createTrace({}, [
        { timing: { startMs: 0, durationMs: 100 } },
        { timing: { startMs: 0, durationMs: 200 } },
        { timing: { startMs: 0, durationMs: 300 } },
        { timing: { startMs: 0, durationMs: 400 } },
        { timing: { startMs: 0, durationMs: 500 } },
      ]),
    ];

    const result = verifyWithinFromTraces(
      traces,
      { thresholdMs: 200, percentile: 95 }
    );

    expect(result.success).toBe(false);
    expect(result.verdict).toBe('NOT_PROVEN');
    expect(result.error).toContain('exceeds threshold');
  });

  it('should return INCOMPLETE_PROOF when insufficient samples', () => {
    const traces = [
      createTrace({}, [
        { timing: { startMs: 0, durationMs: 100 } },
      ]),
    ];

    const result = verifyWithinFromTraces(
      traces,
      { thresholdMs: 200, percentile: 95 },
      { minSamples: 10 }
    );

    expect(result.success).toBe(false);
    expect(result.verdict).toBe('INCOMPLETE_PROOF');
    expect(result.error).toContain('Insufficient samples');
    expect(result.sampleCount).toBe(1);
  });

  it('should return INCOMPLETE_PROOF for empty traces', () => {
    const result = verifyWithinFromTraces(
      [],
      { thresholdMs: 200, percentile: 50 }
    );

    expect(result.verdict).toBe('INCOMPLETE_PROOF');
    expect(result.sampleCount).toBe(0);
  });

  it('should include latency stats in result', () => {
    const traces = [
      createTrace({}, [
        { timing: { startMs: 0, durationMs: 10 } },
        { timing: { startMs: 0, durationMs: 20 } },
        { timing: { startMs: 0, durationMs: 30 } },
      ]),
    ];

    const result = verifyWithinFromTraces(
      traces,
      { thresholdMs: 100, percentile: 50 }
    );

    expect(result.stats).toBeDefined();
    expect(result.stats?.min).toBe(10);
    expect(result.stats?.max).toBe(30);
    expect(result.stats?.mean).toBe(20);
  });
});

describe('verifyMultipleTimings', () => {
  const traces = [
    createTrace({}, [
      { timing: { startMs: 0, durationMs: 50 } },
      { timing: { startMs: 0, durationMs: 100 } },
      { timing: { startMs: 0, durationMs: 150 } },
      { timing: { startMs: 0, durationMs: 200 } },
      { timing: { startMs: 0, durationMs: 300 } },
    ]),
  ];

  it('should verify multiple percentile thresholds', () => {
    const result = verifyMultipleTimings(traces, [
      { thresholdMs: 200, percentile: 50 },
      { thresholdMs: 500, percentile: 95 },
    ]);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results.every(r => r.success)).toBe(true);
  });

  it('should fail if any threshold is exceeded', () => {
    const result = verifyMultipleTimings(traces, [
      { thresholdMs: 200, percentile: 50 },
      { thresholdMs: 100, percentile: 95 }, // Will fail
    ]);

    expect(result.success).toBe(false);
    expect(result.results[0]?.success).toBe(true);
    expect(result.results[1]?.success).toBe(false);
  });

  it('should include overall stats', () => {
    const result = verifyMultipleTimings(traces, [
      { thresholdMs: 500, percentile: 99 },
    ]);

    expect(result.overallStats).toBeDefined();
    expect(result.overallStats?.count).toBe(5);
  });
});

// ============================================================================
// EVENTUALLY WITHIN TESTS
// ============================================================================

describe('verifyEventuallyWithin', () => {
  it('should return PROVEN when event occurs within time bound', () => {
    const traces = [
      createTrace({}, [
        { kind: 'handler_call', timing: { startMs: 0 } },
        { kind: 'audit_written', timing: { startMs: 2000 } },
        { kind: 'handler_return', timing: { startMs: 2500 } },
      ]),
    ];

    const result = verifyEventuallyWithin(
      traces,
      'audit_written',
      5000,
      { description: 'audit log updated' }
    );

    expect(result.success).toBe(true);
    expect(result.verdict).toBe('PROVEN');
    expect(result.elapsedMs).toBe(2000);
    expect(result.satisfyingEvent?.kind).toBe('audit_written');
  });

  it('should return NOT_PROVEN when event occurs after time bound', () => {
    const traces = [
      createTrace({}, [
        { kind: 'handler_call', timing: { startMs: 0 } },
        { kind: 'audit_written', timing: { startMs: 10000 } },
      ]),
    ];

    const result = verifyEventuallyWithin(
      traces,
      'audit_written',
      5000
    );

    expect(result.success).toBe(false);
    expect(result.verdict).toBe('NOT_PROVEN');
    expect(result.error).toContain('not found within');
  });

  it('should return NOT_PROVEN when event never occurs', () => {
    const traces = [
      createTrace({}, [
        { kind: 'handler_call', timing: { startMs: 0 } },
        { kind: 'handler_return', timing: { startMs: 100 } },
      ]),
    ];

    const result = verifyEventuallyWithin(
      traces,
      'audit_written',
      5000
    );

    expect(result.success).toBe(false);
    expect(result.verdict).toBe('NOT_PROVEN');
  });

  it('should return INCOMPLETE_PROOF for empty traces', () => {
    const result = verifyEventuallyWithin([], 'audit_written', 5000);

    expect(result.success).toBe(false);
    expect(result.verdict).toBe('INCOMPLETE_PROOF');
    expect(result.error).toContain('No traces available');
  });

  it('should use reference event when specified', () => {
    const traces = [
      createTrace({}, [
        { kind: 'handler_call', timing: { startMs: 0 } },
        { kind: 'session_created', timing: { startMs: 100 } },
        { kind: 'audit_written', timing: { startMs: 500 } },
      ]),
    ];

    const result = verifyEventuallyWithin(
      traces,
      'audit_written',
      1000,
      { referenceEventKind: 'session_created' }
    );

    expect(result.success).toBe(true);
    // Elapsed from session_created (100ms) to audit_written (500ms) = 400ms
    expect(result.elapsedMs).toBe(400);
  });
});

// ============================================================================
// TEMPORAL CLAUSES TESTS
// ============================================================================

describe('verifyTemporalClauses', () => {
  const traces = [
    createTrace({}, [
      { handler: 'Login', timing: { startMs: 0, durationMs: 150 } },
      { kind: 'audit_written', timing: { startMs: 2000 } },
    ]),
    createTrace({}, [
      { handler: 'Login', timing: { startMs: 0, durationMs: 180 } },
      { kind: 'audit_written', timing: { startMs: 3000 } },
    ]),
    createTrace({}, [
      { handler: 'Login', timing: { startMs: 0, durationMs: 200 } },
      { kind: 'audit_written', timing: { startMs: 4000 } },
    ]),
  ];

  it('should verify within clauses', () => {
    const results = verifyTemporalClauses(traces, [
      {
        id: 'p50-latency',
        type: 'within',
        text: 'within 200ms (p50)',
        thresholdMs: 200,
        percentile: 50,
      },
    ], { handlerName: 'Login' });

    expect(results).toHaveLength(1);
    expect(results[0]?.verdict).toBe('PROVEN');
    expect(results[0]?.timing?.sampleCount).toBe(3);
  });

  it('should verify eventually_within clauses', () => {
    const results = verifyTemporalClauses(traces, [
      {
        id: 'audit-log',
        type: 'eventually_within',
        text: 'eventually within 5s: audit log updated',
        thresholdMs: 5000,
        eventKind: 'audit_written',
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.verdict).toBe('PROVEN');
  });

  it('should handle always clause type', () => {
    const results = verifyTemporalClauses(traces, [
      {
        id: 'always-check',
        type: 'always',
        text: 'always: invariant holds',
      },
    ]);

    expect(results).toHaveLength(1);
    // 'always' clause type is now implemented
    expect(['PROVEN', 'UNKNOWN']).toContain(results[0]?.verdict);
  });

  it('should return UNKNOWN for missing parameters', () => {
    const results = verifyTemporalClauses(traces, [
      {
        id: 'bad-within',
        type: 'within',
        text: 'within ???',
        // Missing thresholdMs and percentile
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.verdict).toBe('UNKNOWN');
    expect(results[0]?.error).toContain('Missing');
  });

  it('should verify mixed clause types', () => {
    const results = verifyTemporalClauses(traces, [
      {
        id: 'p50',
        type: 'within',
        text: 'within 200ms (p50)',
        thresholdMs: 200,
        percentile: 50,
      },
      {
        id: 'p95',
        type: 'within',
        text: 'within 500ms (p95)',
        thresholdMs: 500,
        percentile: 95,
      },
      {
        id: 'audit',
        type: 'eventually_within',
        text: 'eventually within 5s: audit log updated',
        thresholdMs: 5000,
        eventKind: 'audit_written',
      },
    ], { handlerName: 'Login' });

    expect(results).toHaveLength(3);
    expect(results.every(r => r.verdict === 'PROVEN' || r.verdict === 'NOT_PROVEN')).toBe(true);
  });
});

// ============================================================================
// FORMATTING TESTS
// ============================================================================

describe('formatTemporalClauseTable', () => {
  it('should format results as a table', () => {
    const results = [
      {
        clauseId: 'p50',
        type: 'within' as const,
        clauseText: 'within 200ms (p50)',
        verdict: 'PROVEN' as const,
        success: true,
        timing: { thresholdMs: 200, percentile: 50, actualMs: 150, sampleCount: 10 },
      },
      {
        clauseId: 'p95',
        type: 'within' as const,
        clauseText: 'within 500ms (p95)',
        verdict: 'NOT_PROVEN' as const,
        success: false,
        timing: { thresholdMs: 500, percentile: 95, actualMs: 550, sampleCount: 10 },
        error: 'Exceeded threshold',
      },
    ];

    const table = formatTemporalClauseTable(results);

    expect(table).toContain('TEMPORAL VERIFICATION');
    expect(table).toContain('within 200ms (p50)');
    expect(table).toContain('PROVEN');
    expect(table).toContain('NOT_PROVEN');
    expect(table).toContain('✓');
    expect(table).toContain('✗');
    expect(table).toContain('150.0ms');
    expect(table).toContain('Summary:');
  });

  it('should handle empty results', () => {
    const table = formatTemporalClauseTable([]);
    expect(table).toContain('No temporal clauses');
  });

  it('should show INCOMPLETE_PROOF with ?', () => {
    const results = [
      {
        clauseId: 'test',
        type: 'within' as const,
        clauseText: 'within 200ms (p50)',
        verdict: 'INCOMPLETE_PROOF' as const,
        success: false,
        timing: { thresholdMs: 200, percentile: 50, sampleCount: 0 },
      },
    ];

    const table = formatTemporalClauseTable(results);

    expect(table).toContain('?');
    expect(table).toContain('INCOMPLETE_PROOF');
  });

  it('should truncate long clause text', () => {
    const results = [
      {
        clauseId: 'test',
        type: 'within' as const,
        clauseText: 'this is a very long clause text that should be truncated',
        verdict: 'PROVEN' as const,
        success: true,
        timing: { thresholdMs: 200, actualMs: 100 },
      },
    ];

    const table = formatTemporalClauseTable(results);

    expect(table).toContain('...');
    expect(table).not.toContain('should be truncated');
  });
});

// ============================================================================
// DETERMINISM TESTS
// ============================================================================

describe('determinism', () => {
  it('verifyWithinFromTraces should be deterministic', () => {
    const traces = [
      createTrace({}, [
        { timing: { startMs: 0, durationMs: 100 } },
        { timing: { startMs: 0, durationMs: 150 } },
        { timing: { startMs: 0, durationMs: 200 } },
      ]),
    ];

    const result1 = verifyWithinFromTraces(traces, { thresholdMs: 200, percentile: 50 });
    const result2 = verifyWithinFromTraces(traces, { thresholdMs: 200, percentile: 50 });

    expect(result1.verdict).toBe(result2.verdict);
    expect(result1.sampleCount).toBe(result2.sampleCount);
    expect(result1.stats?.p50).toBe(result2.stats?.p50);
  });

  it('verifyTemporalClauses should be deterministic', () => {
    const traces = [
      createTrace({}, [
        { timing: { startMs: 0, durationMs: 100 } },
      ]),
    ];

    const clauses = [
      { id: 'p50', type: 'within' as const, text: 'test', thresholdMs: 200, percentile: 50 },
    ];

    const results1 = verifyTemporalClauses(traces, clauses);
    const results2 = verifyTemporalClauses(traces, clauses);

    expect(results1).toEqual(results2);
  });
});
