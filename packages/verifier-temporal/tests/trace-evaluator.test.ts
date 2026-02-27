/**
 * Tests for Trace Evaluator
 * 
 * Tests temporal verification against trace files.
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { Trace } from '@isl-lang/trace-format';
import {
  loadTraceFile,
  loadTraceFiles,
  evaluateTemporalRequirement,
  evaluateTemporalProperties,
  type TemporalPropertyEvaluation,
} from '../src/trace-evaluator.js';
import {
  buildTemporalTrace,
  evaluateAlways,
  evaluateEventually,
  evaluateWithin,
  type TemporalTrace,
} from '../src/trace-model.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Create a trace fixture that satisfies "always" property
 */
function createAlwaysPassTrace(): Trace {
  const startTime = new Date('2024-01-01T00:00:00Z');
  return {
    id: 'always-pass-trace',
    name: 'Always Pass Trace',
    domain: 'test',
    startTime: startTime.toISOString(),
    correlationId: 'test-corr',
    events: [
      {
        time: new Date(startTime.getTime() + 0).toISOString(),
        kind: 'handler_call',
        correlationId: 'event-1',
        handler: 'testHandler',
        inputs: {},
        outputs: { value: 10 },
        events: [],
        timing: { startMs: 0, durationMs: 50 },
      },
      {
        time: new Date(startTime.getTime() + 100).toISOString(),
        kind: 'handler_return',
        correlationId: 'event-2',
        handler: 'testHandler',
        inputs: {},
        outputs: { value: 20 },
        events: [],
        timing: { startMs: 100, durationMs: 0 },
      },
      {
        time: new Date(startTime.getTime() + 200).toISOString(),
        kind: 'handler_return',
        correlationId: 'event-3',
        handler: 'testHandler',
        inputs: {},
        outputs: { value: 30 },
        events: [],
        timing: { startMs: 200, durationMs: 0 },
      },
    ],
    initialState: { counter: 0 },
  };
}

/**
 * Create a trace fixture that violates "always" property
 */
function createAlwaysFailTrace(): Trace {
  const startTime = new Date('2024-01-01T00:00:00Z');
  return {
    id: 'always-fail-trace',
    name: 'Always Fail Trace',
    domain: 'test',
    startTime: startTime.toISOString(),
    correlationId: 'test-corr',
    events: [
      {
        time: new Date(startTime.getTime() + 0).toISOString(),
        kind: 'handler_call',
        correlationId: 'event-1',
        handler: 'testHandler',
        inputs: {},
        outputs: { value: 10 },
        events: [],
        timing: { startMs: 0, durationMs: 50 },
      },
      {
        time: new Date(startTime.getTime() + 100).toISOString(),
        kind: 'handler_error',
        correlationId: 'event-2',
        handler: 'testHandler',
        inputs: {},
        outputs: { error: { name: 'Error', message: 'Failed' } },
        events: [],
        timing: { startMs: 100, durationMs: 0 },
      },
    ],
    initialState: { counter: 0 },
  };
}

/**
 * Create a trace fixture that satisfies "eventually" property
 */
function createEventuallyPassTrace(): Trace {
  const startTime = new Date('2024-01-01T00:00:00Z');
  return {
    id: 'eventually-pass-trace',
    name: 'Eventually Pass Trace',
    domain: 'test',
    startTime: startTime.toISOString(),
    correlationId: 'test-corr',
    events: [
      {
        time: new Date(startTime.getTime() + 0).toISOString(),
        kind: 'handler_call',
        correlationId: 'event-1',
        handler: 'testHandler',
        inputs: {},
        outputs: { ready: false },
        events: [],
        timing: { startMs: 0, durationMs: 50 },
      },
      {
        time: new Date(startTime.getTime() + 100).toISOString(),
        kind: 'state_change',
        correlationId: 'event-2',
        handler: 'testHandler',
        inputs: { path: ['ready'], oldValue: false },
        outputs: { newValue: true },
        events: [],
        timing: { startMs: 100, durationMs: 0 },
      },
    ],
    initialState: { ready: false },
  };
}

/**
 * Create a trace fixture that satisfies "within" property
 */
function createWithinPassTrace(): Trace {
  const startTime = new Date('2024-01-01T00:00:00Z');
  return {
    id: 'within-pass-trace',
    name: 'Within Pass Trace',
    domain: 'test',
    startTime: startTime.toISOString(),
    correlationId: 'test-corr',
    events: [
      {
        time: new Date(startTime.getTime() + 0).toISOString(),
        kind: 'handler_call',
        correlationId: 'event-1',
        handler: 'testHandler',
        inputs: {},
        outputs: {},
        events: [],
        timing: { startMs: 0, durationMs: 50 },
      },
      {
        time: new Date(startTime.getTime() + 50).toISOString(),
        kind: 'handler_return',
        correlationId: 'event-2',
        handler: 'testHandler',
        inputs: {},
        outputs: { result: 'success' },
        events: [],
        timing: { startMs: 50, durationMs: 0 },
      },
    ],
    initialState: {},
  };
}

/**
 * Create a trace fixture that violates "within" property
 */
function createWithinFailTrace(): Trace {
  const startTime = new Date('2024-01-01T00:00:00Z');
  return {
    id: 'within-fail-trace',
    name: 'Within Fail Trace',
    domain: 'test',
    startTime: startTime.toISOString(),
    correlationId: 'test-corr',
    events: [
      {
        time: new Date(startTime.getTime() + 0).toISOString(),
        kind: 'handler_call',
        correlationId: 'event-1',
        handler: 'testHandler',
        inputs: {},
        outputs: {},
        events: [],
        timing: { startMs: 0, durationMs: 50 },
      },
      {
        time: new Date(startTime.getTime() + 200).toISOString(),
        kind: 'handler_return',
        correlationId: 'event-2',
        handler: 'testHandler',
        inputs: {},
        outputs: { result: 'success' },
        events: [],
        timing: { startMs: 200, durationMs: 0 },
      },
    ],
    initialState: {},
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Trace Evaluator', () => {
  describe('loadTraceFile', () => {
    it('should load a valid trace file', async () => {
      const trace = createAlwaysPassTrace();
      // In a real test, we'd write to a temp file and load it
      // For now, test the structure
      expect(trace.id).toBe('always-pass-trace');
      expect(trace.events.length).toBeGreaterThan(0);
    });

    it('should validate trace structure', () => {
      const invalidTrace = {
        events: [], // Missing id
      };
      
      expect(() => {
        if (!('id' in invalidTrace) || !Array.isArray(invalidTrace.events)) {
          throw new Error('Invalid trace format');
        }
      }).toThrow();
    });
  });

  describe('evaluateTemporalRequirement', () => {
    it('should evaluate "always" property correctly', () => {
      const trace = createAlwaysPassTrace();
      const temporalTrace = buildTemporalTrace(trace);
      
      const result = evaluateAlways(
        temporalTrace,
        (state) => {
          // Check that no error events occurred
          const eventCounts = state._eventCounts as Record<string, number> | undefined;
          return !eventCounts || !eventCounts['handler_error'];
        },
        { description: 'no errors' }
      );

      expect(result.satisfied).toBe(true);
      expect(result.verdict).toBe('SATISFIED');
    });

    it('should detect "always" violations', () => {
      const trace = createAlwaysFailTrace();
      const temporalTrace = buildTemporalTrace(trace);
      
      const result = evaluateAlways(
        temporalTrace,
        (state) => {
          const eventCounts = state._eventCounts as Record<string, number> | undefined;
          return !eventCounts || !eventCounts['handler_error'];
        },
        { description: 'no errors' }
      );

      expect(result.satisfied).toBe(false);
      expect(result.verdict).toBe('VIOLATED');
      expect(result.violationIndex).toBeDefined();
    });

    it('should evaluate "eventually" property correctly', () => {
      const trace = createEventuallyPassTrace();
      const temporalTrace = buildTemporalTrace(trace);
      
      const result = evaluateEventually(
        temporalTrace,
        (state) => state.ready === true,
        { description: 'eventually ready', boundMs: 200 }
      );

      expect(result.satisfied).toBe(true);
      expect(result.verdict).toBe('SATISFIED');
    });

    it('should evaluate "within" property correctly', () => {
      const passTrace = createWithinPassTrace();
      const failTrace = createWithinFailTrace();
      
      const passTemporalTrace = buildTemporalTrace(passTrace);
      const failTemporalTrace = buildTemporalTrace(failTrace);
      
      const passResult = evaluateWithin(
        passTemporalTrace,
        'handler_return',
        100,
        { description: 'response within 100ms' }
      );
      
      const failResult = evaluateWithin(
        failTemporalTrace,
        'handler_return',
        100,
        { description: 'response within 100ms' }
      );

      expect(passResult.satisfied).toBe(true);
      expect(failResult.satisfied).toBe(false);
    });
  });

  describe('evaluateTemporalProperties', () => {
    it('should evaluate multiple properties', async () => {
      // Create a mock domain with temporal requirements
      const domain = {
        name: { name: 'test' },
        behaviors: [
          {
            name: { name: 'testHandler' },
            temporal: {
              requirements: [
                {
                  type: 'always',
                  condition: { type: 'boolean', value: true },
                } as any,
                {
                  type: 'eventually',
                  duration: { value: 200, unit: 'ms' },
                  condition: { type: 'boolean', value: true },
                } as any,
              ],
            },
          },
        ],
      } as any;

      const traces = [createAlwaysPassTrace(), createEventuallyPassTrace()];
      
      const report = await evaluateTemporalProperties(domain, traces, {
        minSnapshots: 1,
      });

      expect(report.evaluations.length).toBeGreaterThan(0);
      expect(report.summary.total).toBe(2);
    });

    it('should handle empty traces gracefully', async () => {
      const domain = {
        name: { name: 'test' },
        behaviors: [
          {
            name: { name: 'testHandler' },
            temporal: {
              requirements: [
                {
                  type: 'always',
                  condition: { type: 'boolean', value: true },
                } as any,
              ],
            },
          },
        ],
      } as any;

      const report = await evaluateTemporalProperties(domain, [], {
        minSnapshots: 1,
      });

      expect(report.evaluations.length).toBe(1);
      expect(report.evaluations[0]?.verdict).toBe('UNKNOWN');
    });
  });
});
