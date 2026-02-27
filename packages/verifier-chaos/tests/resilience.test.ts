/**
 * Integration Tests for Chaos Verification
 * 
 * Tests behavioral resilience under failure conditions:
 * - Timeout scenarios
 * - Retry scenarios  
 * - Partial failure scenarios
 * - Deterministic replay
 * - Invariant violation recording
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { DomainDeclaration, BehaviorDeclaration, Identifier } from '@isl-lang/isl-core';

// Chaos Events
import {
  ChaosEventRegistry,
  createChaosEvent,
  createTimeoutEvent,
  createRetryEvent,
  createPartialFailureEvent,
  bindSpecClause,
  getEventRegistry,
  serializeChaosEvent,
  deserializeChaosEvent,
  type ChaosEvent,
  type SpecClauseRef,
} from '../src/chaos-events.js';

// Deterministic Replay
import {
  SeededRNG,
  ReplayRecorder,
  ReplayPlayer,
  createReplayRecorder,
  createReplayPlayer,
  generateReplaySeed,
  seedFromString,
  type ReplaySession,
} from '../src/replay.js';

// Violations
import {
  ViolationRecorder,
  InvariantRegistry,
  createViolationRecorder,
  createCustomInvariant,
  type InvariantContext,
  type ViolationReport,
} from '../src/violations.js';

// Resilience Verifier
import {
  ResilienceVerifier,
  createResilienceVerifier,
  verifyResilience,
  buildSpecClauseMappings,
  type ResilienceResult,
} from '../src/resilience-verifier.js';

import type { BehaviorImplementation } from '../src/executor.js';

/* ------------------------------------------------------------------ */
/*  Test Fixtures                                                      */
/* ------------------------------------------------------------------ */

function createTestIdentifier(name: string): Identifier {
  return {
    type: 'Identifier',
    name,
    loc: { start: { line: 1, column: 0 }, end: { line: 1, column: name.length } },
  };
}

function createTestBehavior(name: string): BehaviorDeclaration {
  return {
    type: 'BehaviorDeclaration',
    name: createTestIdentifier(name),
    params: [],
    requires: [],
    ensures: [],
    body: [],
    loc: { start: { line: 1, column: 0 }, end: { line: 10, column: 0 } },
  } as unknown as BehaviorDeclaration;
}

function createTestDomain(behaviors: string[] = ['ProcessPayment', 'CreateOrder']): DomainDeclaration {
  return {
    type: 'DomainDeclaration',
    name: createTestIdentifier('TestDomain'),
    behaviors: behaviors.map(createTestBehavior),
    invariants: [],
    types: [],
    imports: [],
    loc: { start: { line: 1, column: 0 }, end: { line: 50, column: 0 } },
  } as unknown as DomainDeclaration;
}

function createTestImplementation(shouldSucceed: boolean = true): BehaviorImplementation {
  let callCount = 0;
  return {
    execute: async (_args: Record<string, unknown>) => {
      callCount++;
      if (!shouldSucceed && callCount <= 2) {
        throw new Error('Transient failure');
      }
      return { success: true, callCount };
    },
  };
}

/* ================================================================== */
/*  CHAOS EVENTS TESTS                                                 */
/* ================================================================== */

describe('ChaosEvents', () => {
  describe('ChaosEventRegistry', () => {
    it('contains built-in timeout events', () => {
      const registry = getEventRegistry();
      const timeoutEvents = registry.getByCategory('timeout');
      
      expect(timeoutEvents.length).toBeGreaterThan(0);
      expect(timeoutEvents.some(e => e.type === 'request_timeout')).toBe(true);
      expect(timeoutEvents.some(e => e.type === 'connection_timeout')).toBe(true);
    });

    it('contains built-in retry events', () => {
      const registry = getEventRegistry();
      const retryEvents = registry.getByCategory('retry');
      
      expect(retryEvents.length).toBeGreaterThan(0);
      expect(retryEvents.some(e => e.type === 'transient_failure')).toBe(true);
      expect(retryEvents.some(e => e.type === 'retry_exhaustion')).toBe(true);
    });

    it('contains built-in partial failure events', () => {
      const registry = getEventRegistry();
      const partialEvents = registry.getByCategory('partial_failure');
      
      expect(partialEvents.length).toBeGreaterThan(0);
      expect(partialEvents.some(e => e.type === 'partial_success')).toBe(true);
      expect(partialEvents.some(e => e.type === 'cascade_failure')).toBe(true);
    });

    it('filters events by severity', () => {
      const registry = getEventRegistry();
      const criticalEvents = registry.getBySeverity('critical');
      
      expect(criticalEvents.every(e => e.severity === 'critical')).toBe(true);
    });

    it('returns only bounded events', () => {
      const registry = getEventRegistry();
      const boundedEvents = registry.getBounded();
      
      expect(boundedEvents.every(e => e.bounded === true)).toBe(true);
      expect(boundedEvents.every(e => e.maxDurationMs !== undefined)).toBe(true);
    });

    it('returns only replayable events', () => {
      const registry = getEventRegistry();
      const replayableEvents = registry.getReplayable();
      
      expect(replayableEvents.every(e => e.replayable === true)).toBe(true);
    });
  });

  describe('Event Creation', () => {
    it('creates timeout events with parameters', () => {
      const event = createTimeoutEvent(5000, 'api/orders');
      
      expect(event.type).toBe('request_timeout');
      expect(event.parameters.timeoutMs).toBe(5000);
      expect(event.parameters.target).toBe('api/orders');
      expect(event.seed).toBeDefined();
      expect(event.id).toMatch(/^chaos_/);
    });

    it('creates retry events with failure type', () => {
      const event = createRetryEvent(3, 'database');
      
      expect(event.type).toBe('transient_failure');
      expect(event.parameters.failuresBeforeSuccess).toBe(3);
      expect(event.parameters.failureType).toBe('database');
    });

    it('creates partial failure events', () => {
      const event = createPartialFailureEvent(0.7, 20);
      
      expect(event.type).toBe('partial_success');
      expect(event.parameters.successRate).toBe(0.7);
      expect(event.parameters.totalOperations).toBe(20);
    });

    it('allows custom seed for determinism', () => {
      const seed = 12345;
      const event1 = createTimeoutEvent(1000, 'test', [], seed);
      const event2 = createTimeoutEvent(1000, 'test', [], seed);
      
      expect(event1.seed).toBe(seed);
      expect(event2.seed).toBe(seed);
    });
  });

  describe('Spec Clause Binding', () => {
    it('binds spec clauses to events', () => {
      const event = createTimeoutEvent(5000);
      const boundEvent = bindSpecClause(
        event,
        'ProcessPayment',
        'ensures.timeout',
        'Payment must complete within timeout'
      );
      
      expect(boundEvent.specClauses).toHaveLength(1);
      expect(boundEvent.specClauses[0]!.behavior).toBe('ProcessPayment');
      expect(boundEvent.specClauses[0]!.clause).toBe('ensures.timeout');
    });

    it('accumulates multiple spec clauses', () => {
      let event = createTimeoutEvent(5000);
      event = bindSpecClause(event, 'ProcessPayment', 'ensures.timeout', 'desc1');
      event = bindSpecClause(event, 'ProcessPayment', 'requires.valid', 'desc2');
      
      expect(event.specClauses).toHaveLength(2);
    });
  });

  describe('Event Serialization', () => {
    it('serializes and deserializes events', () => {
      const original = createTimeoutEvent(5000, 'test', [
        { behavior: 'Test', clause: 'ensures.1', description: 'Test clause' },
      ]);
      original.outcome = {
        handled: true,
        durationMs: 100,
        violations: [],
      };
      
      const serialized = serializeChaosEvent(original);
      const deserialized = deserializeChaosEvent(serialized);
      
      expect(deserialized.type).toBe(original.type);
      expect(deserialized.seed).toBe(original.seed);
      expect(deserialized.parameters).toEqual(original.parameters);
      expect(deserialized.specClauses).toEqual(original.specClauses);
      expect(deserialized.outcome?.handled).toBe(true);
    });
  });
});

/* ================================================================== */
/*  DETERMINISTIC REPLAY TESTS                                         */
/* ================================================================== */

describe('DeterministicReplay', () => {
  describe('SeededRNG', () => {
    it('produces deterministic sequences', () => {
      const seed = 42;
      const rng1 = new SeededRNG(seed);
      const rng2 = new SeededRNG(seed);
      
      const sequence1 = [rng1.next(), rng1.next(), rng1.next()];
      const sequence2 = [rng2.next(), rng2.next(), rng2.next()];
      
      expect(sequence1).toEqual(sequence2);
    });

    it('produces different sequences for different seeds', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(43);
      
      expect(rng1.next()).not.toBe(rng2.next());
    });

    it('generates integers in range', () => {
      const rng = new SeededRNG(123);
      
      for (let i = 0; i < 100; i++) {
        const value = rng.nextInt(10, 20);
        expect(value).toBeGreaterThanOrEqual(10);
        expect(value).toBeLessThanOrEqual(20);
      }
    });

    it('generates floats in range', () => {
      const rng = new SeededRNG(123);
      
      for (let i = 0; i < 100; i++) {
        const value = rng.nextFloat(1.5, 3.5);
        expect(value).toBeGreaterThanOrEqual(1.5);
        expect(value).toBeLessThan(3.5);
      }
    });

    it('generates booleans with probability', () => {
      const rng = new SeededRNG(123);
      let trueCount = 0;
      const iterations = 1000;
      
      for (let i = 0; i < iterations; i++) {
        if (rng.nextBool(0.7)) trueCount++;
      }
      
      // Should be roughly 70% true (with some variance)
      expect(trueCount / iterations).toBeGreaterThan(0.6);
      expect(trueCount / iterations).toBeLessThan(0.8);
    });

    it('shuffles arrays deterministically', () => {
      const seed = 999;
      const arr1 = [1, 2, 3, 4, 5];
      const arr2 = [1, 2, 3, 4, 5];
      
      new SeededRNG(seed).shuffle(arr1);
      new SeededRNG(seed).shuffle(arr2);
      
      expect(arr1).toEqual(arr2);
      expect(arr1).not.toEqual([1, 2, 3, 4, 5]); // Should be shuffled
    });

    it('picks elements deterministically', () => {
      const seed = 777;
      const arr = ['a', 'b', 'c', 'd', 'e'];
      
      const rng1 = new SeededRNG(seed);
      const rng2 = new SeededRNG(seed);
      
      expect(rng1.pick(arr)).toBe(rng2.pick(arr));
    });

    it('resets to initial state', () => {
      const rng = new SeededRNG(42);
      const first = rng.next();
      rng.next();
      rng.next();
      
      rng.reset();
      expect(rng.next()).toBe(first);
    });
  });

  describe('ReplayRecorder', () => {
    it('records chaos events', () => {
      const recorder = createReplayRecorder(12345);
      const event = createTimeoutEvent(5000);
      
      recorder.recordEvent(event);
      
      const session = recorder.exportSession();
      expect(session.events).toHaveLength(1);
      expect(session.events[0]!.type).toBe('request_timeout');
    });

    it('records event outcomes', () => {
      const recorder = createReplayRecorder();
      const event = createTimeoutEvent(5000);
      
      recorder.recordEvent(event);
      recorder.recordOutcome(event.id, {
        handled: true,
        durationMs: 100,
        violations: [],
      });
      
      const session = recorder.exportSession();
      expect(session.events[0]!.outcome?.handled).toBe(true);
    });

    it('records scenario results', () => {
      const recorder = createReplayRecorder();
      
      recorder.recordScenarioResult('test_scenario', true, 500);
      
      const session = recorder.exportSession();
      expect(session.scenarioResults).toHaveLength(1);
      expect(session.scenarioResults[0]!.name).toBe('test_scenario');
      expect(session.scenarioResults[0]!.passed).toBe(true);
    });

    it('provides deterministic RNG', () => {
      const seed = 54321;
      const recorder1 = createReplayRecorder(seed);
      const recorder2 = createReplayRecorder(seed);
      
      expect(recorder1.getRNG().next()).toBe(recorder2.getRNG().next());
    });

    it('serializes session to JSON', () => {
      const recorder = createReplayRecorder(999);
      recorder.recordEvent(createTimeoutEvent(1000));
      recorder.setMetadata('testKey', 'testValue');
      
      const json = recorder.serialize();
      const parsed = JSON.parse(json);
      
      expect(parsed.seed).toBe(999);
      expect(parsed.events).toHaveLength(1);
      expect(parsed.metadata.testKey).toBe('testValue');
    });
  });

  describe('ReplayPlayer', () => {
    let session: ReplaySession;

    beforeEach(() => {
      const recorder = createReplayRecorder(42);
      recorder.recordEvent(createTimeoutEvent(1000, 'test1'));
      recorder.recordEvent(createRetryEvent(2, 'network'));
      recorder.recordEvent(createPartialFailureEvent(0.5, 10));
      recorder.recordScenarioResult('scenario1', true, 100);
      session = recorder.exportSession();
    });

    it('replays events in order', () => {
      const player = createReplayPlayer(session);
      
      const event1 = player.nextEvent();
      const event2 = player.nextEvent();
      const event3 = player.nextEvent();
      
      expect(event1?.type).toBe('request_timeout');
      expect(event2?.type).toBe('transient_failure');
      expect(event3?.type).toBe('partial_success');
    });

    it('tracks progress', () => {
      const player = createReplayPlayer(session);
      
      expect(player.progress()).toBe(0);
      expect(player.totalEvents()).toBe(3);
      
      player.nextEvent();
      expect(player.progress()).toBe(1);
      
      player.nextEvent();
      expect(player.progress()).toBe(2);
    });

    it('peeks without advancing', () => {
      const player = createReplayPlayer(session);
      
      const peek1 = player.peekEvent();
      const peek2 = player.peekEvent();
      const next = player.nextEvent();
      
      expect(peek1?.id).toBe(peek2?.id);
      expect(peek1?.id).toBe(next?.id);
    });

    it('provides same RNG sequence as recorder', () => {
      const player = createReplayPlayer(session);
      const rng = player.getRNG();
      
      // Should match the sequence from seed 42
      const recorderRng = new SeededRNG(42);
      expect(rng.next()).toBe(recorderRng.next());
    });

    it('resets to beginning', () => {
      const player = createReplayPlayer(session);
      
      player.nextEvent();
      player.nextEvent();
      player.reset();
      
      expect(player.progress()).toBe(0);
      expect(player.nextEvent()?.type).toBe('request_timeout');
    });

    it('returns null when exhausted', () => {
      const player = createReplayPlayer(session);
      
      player.nextEvent();
      player.nextEvent();
      player.nextEvent();
      
      expect(player.hasMore()).toBe(false);
      expect(player.nextEvent()).toBeNull();
    });
  });

  describe('Seed Utilities', () => {
    it('generates random seeds', () => {
      const seed1 = generateReplaySeed();
      const seed2 = generateReplaySeed();
      
      expect(typeof seed1).toBe('number');
      expect(seed1).toBeGreaterThan(0);
      expect(seed1).not.toBe(seed2); // Extremely unlikely to match
    });

    it('generates deterministic seeds from strings', () => {
      const seed1 = seedFromString('test-scenario-1');
      const seed2 = seedFromString('test-scenario-1');
      const seed3 = seedFromString('test-scenario-2');
      
      expect(seed1).toBe(seed2);
      expect(seed1).not.toBe(seed3);
    });
  });
});

/* ================================================================== */
/*  INVARIANT VIOLATIONS TESTS                                         */
/* ================================================================== */

describe('InvariantViolations', () => {
  describe('ViolationRecorder', () => {
    let recorder: ViolationRecorder;

    beforeEach(() => {
      recorder = createViolationRecorder();
    });

    it('records violations', () => {
      const invariant = createCustomInvariant(
        'test_invariant',
        'Test Invariant',
        'A test invariant',
        'state_consistency',
        'error',
        () => ({
          passed: false,
          violation: {
            invariant: 'test_invariant',
            expected: 'value A',
            actual: 'value B',
          },
        })
      );
      
      recorder.registerInvariant(invariant);
      const context: InvariantContext = {
        state: {},
        timeline: [],
        chaosEvents: [],
      };
      
      const violations = recorder.checkAll(context);
      
      expect(violations).toHaveLength(1);
      expect(violations[0]!.invariant.id).toBe('test_invariant');
    });

    it('filters violations by severity', () => {
      const errorInvariant = createCustomInvariant(
        'error_inv', 'Error', 'desc', 'state_consistency', 'error',
        () => ({ passed: false, violation: { invariant: 'error_inv', expected: 1, actual: 2 } })
      );
      const criticalInvariant = createCustomInvariant(
        'critical_inv', 'Critical', 'desc', 'data_integrity', 'critical',
        () => ({ passed: false, violation: { invariant: 'critical_inv', expected: 1, actual: 2 } })
      );
      
      recorder.registerInvariant(errorInvariant);
      recorder.registerInvariant(criticalInvariant);
      recorder.checkAll({ state: {}, timeline: [], chaosEvents: [] });
      
      expect(recorder.getViolationsBySeverity('error').length).toBeGreaterThanOrEqual(1);
      expect(recorder.getViolationsBySeverity('critical').length).toBeGreaterThanOrEqual(1);
    });

    it('filters violations by category', () => {
      const inv = createCustomInvariant(
        'ordering_inv', 'Ordering', 'desc', 'ordering', 'error',
        () => ({ passed: false, violation: { invariant: 'ordering_inv', expected: 1, actual: 2 } })
      );
      
      recorder.registerInvariant(inv);
      recorder.checkAll({ state: {}, timeline: [], chaosEvents: [] });
      
      const orderingViolations = recorder.getViolationsByCategory('ordering');
      expect(orderingViolations.length).toBeGreaterThanOrEqual(1);
    });

    it('detects critical violations', () => {
      const criticalInv = createCustomInvariant(
        'critical_test', 'Critical', 'desc', 'atomicity', 'critical',
        () => ({ passed: false, violation: { invariant: 'critical_test', expected: 1, actual: 2 } })
      );
      
      recorder.registerInvariant(criticalInv);
      recorder.checkAll({ state: {}, timeline: [], chaosEvents: [] });
      
      expect(recorder.hasCriticalViolations()).toBe(true);
    });

    it('generates violation report', () => {
      const inv = createCustomInvariant(
        'report_test', 'Report Test', 'desc', 'timing', 'warning',
        () => ({ passed: false, violation: { invariant: 'report_test', expected: 'a', actual: 'b' } })
      );
      
      recorder.registerInvariant(inv);
      recorder.checkAll({ state: {}, timeline: [], chaosEvents: [] });
      
      const report = recorder.generateReport();
      
      expect(report.totalViolations).toBeGreaterThanOrEqual(1);
      expect(report.bySeverity.warning).toBeGreaterThanOrEqual(1);
      expect(report.byCategory.timing).toBeGreaterThanOrEqual(1);
      expect(report.violations.length).toBeGreaterThanOrEqual(1);
    });

    it('clears violations', () => {
      const inv = createCustomInvariant(
        'clear_test', 'Clear Test', 'desc', 'state_consistency', 'error',
        () => ({ passed: false, violation: { invariant: 'clear_test', expected: 1, actual: 2 } })
      );
      
      recorder.registerInvariant(inv);
      recorder.checkAll({ state: {}, timeline: [], chaosEvents: [] });
      
      expect(recorder.count()).toBeGreaterThan(0);
      
      recorder.clear();
      
      expect(recorder.count()).toBe(0);
    });
  });

  describe('InvariantRegistry', () => {
    it('contains built-in invariants', () => {
      const registry = new InvariantRegistry();
      const all = registry.all();
      
      expect(all.length).toBeGreaterThan(0);
      expect(all.some(i => i.category === 'state_consistency')).toBe(true);
      expect(all.some(i => i.category === 'idempotency')).toBe(true);
    });

    it('registers custom invariants', () => {
      const registry = new InvariantRegistry();
      const custom = createCustomInvariant(
        'custom_1', 'Custom', 'desc', 'durability', 'error',
        () => ({ passed: true })
      );
      
      registry.register(custom);
      
      expect(registry.get('custom_1')).toBeDefined();
    });
  });

  describe('Built-in Invariants', () => {
    it('checks monotonic version numbers', () => {
      const recorder = createViolationRecorder();
      
      const context: InvariantContext = {
        state: { version: 5 },
        previousState: { version: 10 }, // version went DOWN
        timeline: [],
        chaosEvents: [],
      };
      
      const violations = recorder.checkAll(context);
      const versionViolation = violations.find(v => v.invariant.id === 'monotonic_version');
      
      expect(versionViolation).toBeDefined();
    });

    it('checks causal ordering', () => {
      const recorder = createViolationRecorder();
      
      const context: InvariantContext = {
        state: {},
        timeline: [
          { id: '1', type: 'behavior_start', timestamp: 100, data: {} },
          { id: '2', type: 'behavior_end', timestamp: 50, data: {} }, // Out of order
        ],
        chaosEvents: [],
      };
      
      const violations = recorder.checkAll(context);
      const orderingViolation = violations.find(v => v.invariant.id === 'causal_ordering');
      
      expect(orderingViolation).toBeDefined();
    });
  });
});

/* ================================================================== */
/*  RESILIENCE VERIFIER TESTS                                          */
/* ================================================================== */

describe('ResilienceVerifier', () => {
  describe('Basic Verification', () => {
    it('verifies resilient implementation', async () => {
      const domain = createTestDomain(['ProcessPayment']);
      const impl = createTestImplementation(true);
      
      const result = await verifyResilience({
        domain,
        implementation: impl,
        behaviorName: 'ProcessPayment',
        config: { seed: 12345, timeoutMs: 5000 },
      });
      
      expect(result.seed).toBe(12345);
      expect(result.chaosEvents.length).toBeGreaterThan(0);
      expect(result.violationReport).toBeDefined();
    });

    it('uses deterministic seed', async () => {
      const domain = createTestDomain(['TestBehavior']);
      const impl = createTestImplementation(true);
      const seed = 99999;
      
      const result1 = await verifyResilience({
        domain,
        implementation: impl,
        config: { seed, timeoutMs: 5000 },
      });
      
      const result2 = await verifyResilience({
        domain,
        implementation: impl,
        config: { seed, timeoutMs: 5000 },
      });
      
      expect(result1.seed).toBe(result2.seed);
      // Events should have same seeds
      expect(result1.chaosEvents.map(e => e.seed))
        .toEqual(result2.chaosEvents.map(e => e.seed));
    });

    it('records replay session when enabled', async () => {
      const domain = createTestDomain(['TestBehavior']);
      const impl = createTestImplementation(true);
      
      const result = await verifyResilience({
        domain,
        implementation: impl,
        config: { recordReplay: true, timeoutMs: 5000 },
      });
      
      expect(result.replaySession).toBeDefined();
      expect(result.replaySession!.seed).toBe(result.seed);
    });
  });

  describe('Spec Clause Mapping', () => {
    it('maps chaos events to spec clauses', async () => {
      const domain = createTestDomain(['ProcessPayment']);
      const impl = createTestImplementation(true);
      
      const specMappings = buildSpecClauseMappings([
        ['ProcessPayment', [
          { clause: 'ensures.timeout', description: 'Must complete within timeout' },
          { clause: 'ensures.retry', description: 'Must handle retries' },
        ]],
      ]);
      
      const result = await verifyResilience({
        domain,
        implementation: impl,
        behaviorName: 'ProcessPayment',
        config: { specClauseMappings: specMappings, timeoutMs: 5000 },
      });
      
      const eventsWithClauses = result.chaosEvents.filter(e => e.specClauses.length > 0);
      expect(eventsWithClauses.length).toBeGreaterThan(0);
    });
  });

  describe('Violation Detection', () => {
    it('detects and reports violations', async () => {
      const domain = createTestDomain(['TestBehavior']);
      const impl = createTestImplementation(true);
      
      const verifier = createResilienceVerifier({
        checkInvariants: true,
        customInvariants: [
          [
            'always_fail',
            'Always Fail',
            'Test invariant that always fails',
            'state_consistency',
            'warning',
            () => ({
              passed: false,
              violation: {
                invariant: 'always_fail',
                expected: 'pass',
                actual: 'fail',
              },
            }),
            [],
          ],
        ],
        timeoutMs: 5000,
      });
      
      const result = await verifier.verify({
        domain,
        implementation: impl,
      });
      
      expect(result.violationReport.totalViolations).toBeGreaterThan(0);
    });
  });

  describe('Replay Functionality', () => {
    it('replays verification session', async () => {
      const domain = createTestDomain(['TestBehavior']);
      const impl = createTestImplementation(true);
      const seed = 77777;
      
      // Run initial verification
      const verifier = createResilienceVerifier({
        seed,
        recordReplay: true,
        timeoutMs: 5000,
      });
      
      const originalResult = await verifier.verify({
        domain,
        implementation: impl,
      });
      
      // Replay
      const replayResult = await verifier.replay(
        originalResult.replaySession!,
        { domain, implementation: impl }
      );
      
      expect(replayResult.seed).toBe(seed);
      expect(replayResult.chaosEvents.length).toBe(originalResult.chaosEvents.length);
    });
  });
});

/* ================================================================== */
/*  INTEGRATION TESTS                                                  */
/* ================================================================== */

describe('Integration', () => {
  describe('End-to-End Chaos Verification', () => {
    it('verifies timeout resilience', async () => {
      const domain = createTestDomain(['ProcessPayment']);
      const impl = createTestImplementation(true);
      
      const result = await verifyResilience({
        domain,
        implementation: impl,
        behaviorName: 'ProcessPayment',
        config: {
          seed: seedFromString('timeout-test'),
          checkInvariants: true,
          recordReplay: true,
          timeoutMs: 5000,
        },
      });
      
      // Should have timeout events
      const timeoutEvents = result.chaosEvents.filter(e => e.type === 'request_timeout');
      expect(timeoutEvents.length).toBeGreaterThan(0);
      
      // Each timeout event should be bounded
      for (const event of timeoutEvents) {
        const def = getEventRegistry().get(event.type);
        expect(def?.bounded).toBe(true);
        expect(def?.maxDurationMs).toBeDefined();
      }
    });

    it('verifies retry resilience', async () => {
      const domain = createTestDomain(['ProcessPayment']);
      const impl = createTestImplementation(true);
      
      const result = await verifyResilience({
        domain,
        implementation: impl,
        behaviorName: 'ProcessPayment',
        config: {
          seed: seedFromString('retry-test'),
          timeoutMs: 5000,
        },
      });
      
      const retryEvents = result.chaosEvents.filter(e => e.type === 'transient_failure');
      expect(retryEvents.length).toBeGreaterThan(0);
    });

    it('verifies partial failure resilience', async () => {
      const domain = createTestDomain(['ProcessPayment']);
      const impl = createTestImplementation(true);
      
      const result = await verifyResilience({
        domain,
        implementation: impl,
        behaviorName: 'ProcessPayment',
        config: {
          seed: seedFromString('partial-failure-test'),
          timeoutMs: 5000,
        },
      });
      
      const partialEvents = result.chaosEvents.filter(e => e.type === 'partial_success');
      expect(partialEvents.length).toBeGreaterThan(0);
    });

    it('produces deterministic results across runs', async () => {
      const domain = createTestDomain(['ProcessPayment']);
      const impl = createTestImplementation(true);
      const seed = 123456789;
      
      const result1 = await verifyResilience({
        domain,
        implementation: impl,
        config: { seed, timeoutMs: 5000 },
      });
      
      const result2 = await verifyResilience({
        domain,
        implementation: impl,
        config: { seed, timeoutMs: 5000 },
      });
      
      // Same seed should produce same event types in same order
      expect(result1.chaosEvents.map(e => e.type))
        .toEqual(result2.chaosEvents.map(e => e.type));
      
      // Same parameters (controlled by seeded RNG)
      expect(result1.chaosEvents.map(e => e.parameters))
        .toEqual(result2.chaosEvents.map(e => e.parameters));
    });

    it('maps failures to spec clauses for traceability', async () => {
      const domain = createTestDomain(['ProcessPayment']);
      const impl = createTestImplementation(true);
      
      const specMappings = buildSpecClauseMappings([
        ['ProcessPayment', [
          { clause: 'ensures.timeout_handling', description: 'Handles timeouts gracefully' },
          { clause: 'ensures.retry_policy', description: 'Implements retry with backoff' },
          { clause: 'ensures.partial_failure', description: 'Handles partial failures' },
        ]],
      ]);
      
      const result = await verifyResilience({
        domain,
        implementation: impl,
        behaviorName: 'ProcessPayment',
        config: {
          specClauseMappings: specMappings,
          timeoutMs: 5000,
        },
      });
      
      // Violations should reference spec clauses
      for (const violation of result.violationReport.violations) {
        if (violation.specClauses.length > 0) {
          expect(violation.specClauses[0]!.behavior).toBe('ProcessPayment');
        }
      }
    });
  });

  describe('Bounded and Repeatable Chaos', () => {
    it('all chaos events are bounded', () => {
      const registry = getEventRegistry();
      const allEvents = registry.all();
      
      // Every event should be bounded for predictable verification
      for (const event of allEvents) {
        expect(event.bounded).toBe(true);
        if (event.bounded) {
          expect(event.maxDurationMs).toBeDefined();
          expect(event.maxDurationMs).toBeGreaterThan(0);
        }
      }
    });

    it('all chaos events are replayable', () => {
      const registry = getEventRegistry();
      const allEvents = registry.all();
      
      for (const event of allEvents) {
        expect(event.replayable).toBe(true);
      }
    });

    it('replay produces identical chaos event sequence', async () => {
      const domain = createTestDomain(['TestBehavior']);
      const impl = createTestImplementation(true);
      const seed = 999888777;
      
      const verifier = createResilienceVerifier({
        seed,
        recordReplay: true,
        checkInvariants: true,
        timeoutMs: 5000,
      });
      
      const original = await verifier.verify({ domain, implementation: impl });
      const replayed = await verifier.replay(original.replaySession!, {
        domain,
        implementation: impl,
      });
      
      // Replay must produce identical chaos event sequence
      expect(replayed.chaosEvents.length).toBe(original.chaosEvents.length);
      expect(replayed.chaosEvents.map(e => e.type))
        .toEqual(original.chaosEvents.map(e => e.type));
      expect(replayed.chaosEvents.map(e => e.parameters))
        .toEqual(original.chaosEvents.map(e => e.parameters));
    });
  });
});
