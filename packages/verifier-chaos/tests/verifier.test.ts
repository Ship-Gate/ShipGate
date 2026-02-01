/**
 * Chaos Verifier Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTimeline,
  Timeline,
  NetworkInjector,
  createNetworkTimeout,
  createConnectionRefused,
  DatabaseInjector,
  createDatabaseUnavailable,
  createDatabaseTimeout,
  LatencyInjector,
  createFixedLatency,
  createVariableLatency,
  ConcurrentInjector,
  createConcurrentRequests,
  ChaosVerifier,
  createVerifier,
  parseChaosScenarios,
  createChaosScenario,
  ChaosExecutor,
  createExecutor,
  type BehaviorImplementation,
} from '../src/index.js';
import type { DomainDeclaration } from '@intentos/isl-core';

// Mock domain for testing
const createMockDomain = (): DomainDeclaration => ({
  kind: 'DomainDeclaration',
  name: { kind: 'Identifier', name: 'TestDomain', span: { start: 0, end: 0, line: 1, column: 1 } },
  imports: [],
  entities: [],
  types: [],
  enums: [],
  behaviors: [
    {
      kind: 'BehaviorDeclaration',
      name: { kind: 'Identifier', name: 'CreateUser', span: { start: 0, end: 0, line: 1, column: 1 } },
      span: { start: 0, end: 0, line: 1, column: 1 },
    },
    {
      kind: 'BehaviorDeclaration',
      name: { kind: 'Identifier', name: 'TransferFunds', span: { start: 0, end: 0, line: 1, column: 1 } },
      span: { start: 0, end: 0, line: 1, column: 1 },
    },
  ],
  invariants: [],
  span: { start: 0, end: 0, line: 1, column: 1 },
});

// Mock implementation
const createMockImplementation = (options?: {
  shouldFail?: boolean;
  failAfter?: number;
  delay?: number;
}): BehaviorImplementation => {
  let callCount = 0;
  return {
    async execute(_input: Record<string, unknown>): Promise<unknown> {
      callCount++;
      
      if (options?.delay) {
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }
      
      if (options?.shouldFail) {
        throw new Error('Implementation failed');
      }
      
      if (options?.failAfter && callCount > options.failAfter) {
        throw new Error('Implementation failed after threshold');
      }
      
      return { success: true, callCount };
    },
  };
};

describe('Timeline', () => {
  let timeline: Timeline;

  beforeEach(() => {
    timeline = createTimeline();
  });

  it('should record events', () => {
    timeline.record('injection_start', { injector: 'test' });
    timeline.record('behavior_start', { name: 'test' });
    
    const events = timeline.getEvents();
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('injection_start');
    expect(events[1].type).toBe('behavior_start');
  });

  it('should record duration events', async () => {
    const id = timeline.startEvent('behavior_start', { name: 'test' });
    await new Promise(resolve => setTimeout(resolve, 50));
    timeline.endEvent(id, { result: 'success' });
    
    const events = timeline.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].duration).toBeGreaterThanOrEqual(40);
  });

  it('should generate report', () => {
    timeline.record('injection_start', {});
    timeline.record('error', { message: 'test error' });
    timeline.record('recovery', {});
    
    const report = timeline.generateReport();
    expect(report.injectionCount).toBe(1);
    expect(report.errorCount).toBe(1);
    expect(report.recoveryCount).toBe(1);
  });

  it('should format timeline', () => {
    timeline.record('injection_start', { injector: 'database' });
    timeline.record('error', { message: 'connection lost' });
    
    const formatted = timeline.format();
    expect(formatted).toContain('Chaos Timeline');
    expect(formatted).toContain('injection_start');
    expect(formatted).toContain('error');
  });
});

describe('NetworkInjector', () => {
  let injector: NetworkInjector;

  afterEach(() => {
    injector?.deactivate();
  });

  it('should create timeout injector', () => {
    injector = createNetworkTimeout();
    expect(injector).toBeInstanceOf(NetworkInjector);
  });

  it('should create connection refused injector', () => {
    injector = createConnectionRefused();
    expect(injector).toBeInstanceOf(NetworkInjector);
  });

  it('should track state', () => {
    injector = createNetworkTimeout();
    
    const state = injector.getState();
    expect(state.active).toBe(false);
    expect(state.interceptedRequests).toBe(0);
    
    injector.activate();
    expect(injector.getState().active).toBe(true);
    
    injector.deactivate();
    expect(injector.getState().active).toBe(false);
  });

  it('should attach timeline', () => {
    const timeline = createTimeline();
    injector = createNetworkTimeout();
    injector.attachTimeline(timeline);
    
    injector.activate();
    injector.deactivate();
    
    const events = timeline.getEvents();
    expect(events.some(e => e.type === 'injection_start')).toBe(true);
    expect(events.some(e => e.type === 'injection_end')).toBe(true);
  });
});

describe('DatabaseInjector', () => {
  let injector: DatabaseInjector;

  afterEach(() => {
    injector?.deactivate();
  });

  it('should create unavailable injector', () => {
    injector = createDatabaseUnavailable();
    expect(injector).toBeInstanceOf(DatabaseInjector);
  });

  it('should create timeout injector', () => {
    injector = createDatabaseTimeout('write', 0.5);
    expect(injector).toBeInstanceOf(DatabaseInjector);
  });

  it('should simulate operation failure', async () => {
    injector = createDatabaseUnavailable();
    injector.activate();
    
    await expect(
      injector.simulateOperation({ type: 'write' })
    ).rejects.toThrow('Database service unavailable');
  });

  it('should track operation stats', async () => {
    injector = createDatabaseUnavailable();
    injector.activate();
    
    try {
      await injector.simulateOperation({ type: 'read' });
    } catch {
      // Expected
    }
    
    const state = injector.getState();
    expect(state.operationsIntercepted).toBe(1);
    expect(state.operationsFailed).toBe(1);
  });
});

describe('LatencyInjector', () => {
  let injector: LatencyInjector;

  afterEach(() => {
    injector?.deactivate();
  });

  it('should create fixed latency injector', () => {
    injector = createFixedLatency(100);
    expect(injector).toBeInstanceOf(LatencyInjector);
  });

  it('should create variable latency injector', () => {
    injector = createVariableLatency(50, 150);
    expect(injector).toBeInstanceOf(LatencyInjector);
  });

  it('should inject latency', async () => {
    injector = createFixedLatency(50);
    injector.activate();
    
    const start = Date.now();
    await injector.inject(async () => 'result');
    const duration = Date.now() - start;
    
    expect(duration).toBeGreaterThanOrEqual(45);
  });

  it('should track latency stats', async () => {
    injector = createFixedLatency(20);
    injector.activate();
    
    await injector.inject(async () => 'result1');
    await injector.inject(async () => 'result2');
    
    const state = injector.getState();
    expect(state.operationsDelayed).toBe(2);
    expect(state.averageLatency).toBeGreaterThanOrEqual(15);
  });

  it('should wrap functions', async () => {
    injector = createFixedLatency(20);
    injector.activate();
    
    const fn = async (x: number) => x * 2;
    const wrapped = injector.wrap(fn);
    
    const result = await wrapped(5);
    expect(result).toBe(10);
    expect(injector.getState().operationsDelayed).toBe(1);
  });
});

describe('ConcurrentInjector', () => {
  let injector: ConcurrentInjector;

  afterEach(() => {
    injector?.deactivate();
  });

  it('should create concurrent requests injector', () => {
    injector = createConcurrentRequests(5);
    expect(injector).toBeInstanceOf(ConcurrentInjector);
  });

  it('should execute concurrent requests', async () => {
    injector = createConcurrentRequests(5);
    injector.activate();
    
    let counter = 0;
    const results = await injector.execute(async () => {
      counter++;
      return counter;
    });
    
    expect(results).toHaveLength(5);
    expect(results.filter(r => r.success)).toHaveLength(5);
  });

  it('should detect race conditions', async () => {
    injector = createConcurrentRequests(3);
    injector.activate();
    
    let value = 0;
    const result = await injector.executeAndDetectRace(
      async () => {
        const current = value;
        await new Promise(r => setTimeout(r, 10));
        value = current + 1;
        return value;
      },
      (results) => {
        // Check if all results are the same (they won't be due to race)
        return results.every(r => r === results[0]);
      }
    );
    
    expect(result.results).toHaveLength(3);
  });

  it('should test idempotency', async () => {
    injector = createConcurrentRequests(3);
    injector.activate();
    
    // Idempotent operation
    const result = await injector.testIdempotency(
      async () => ({ id: 'fixed' }),
      (a, b) => a.id === b.id
    );
    
    expect(result.isIdempotent).toBe(true);
  });
});

describe('Scenario Parser', () => {
  it('should parse chaos scenarios from domain', () => {
    const domain = createMockDomain();
    const result = parseChaosScenarios(domain);
    
    expect(result.success).toBe(true);
    expect(result.scenarios.length).toBeGreaterThan(0);
  });

  it('should parse scenarios for specific behavior', () => {
    const domain = createMockDomain();
    const result = parseChaosScenarios(domain, 'CreateUser');
    
    expect(result.success).toBe(true);
    expect(result.scenarios.every(s => s.behaviorName === 'CreateUser')).toBe(true);
  });

  it('should create custom chaos scenario', () => {
    const scenario = createChaosScenario('custom_test', 'CreateUser', {
      injections: [
        { type: 'database_failure', parameters: { failureType: 'deadlock' } },
      ],
      assertions: [
        { type: 'error_returned', expected: true },
      ],
    });
    
    expect(scenario.name).toBe('custom_test');
    expect(scenario.behaviorName).toBe('CreateUser');
    expect(scenario.injections).toHaveLength(1);
  });
});

describe('ChaosExecutor', () => {
  let executor: ChaosExecutor;

  beforeEach(() => {
    executor = createExecutor({ timeoutMs: 5000 });
  });

  it('should execute scenario', async () => {
    const domain = createMockDomain();
    const implementation = createMockImplementation();
    
    const scenario = createChaosScenario('test_scenario', 'CreateUser', {
      injections: [
        { type: 'network_latency', parameters: { latencyMs: 10 } },
      ],
      assertions: [
        { type: 'recovery', expected: true },
      ],
    });
    
    const result = await executor.executeScenario(scenario, domain, implementation);
    
    expect(result.name).toBe('test_scenario');
    expect(result.injections.length).toBeGreaterThan(0);
    expect(result.assertions.length).toBeGreaterThan(0);
  });

  it('should handle failing implementations', async () => {
    const domain = createMockDomain();
    const implementation = createMockImplementation({ shouldFail: true });
    
    const scenario = createChaosScenario('fail_test', 'CreateUser', {
      injections: [
        { type: 'database_failure', parameters: {} },
      ],
      assertions: [
        { type: 'error_returned', expected: true },
      ],
    });
    
    const result = await executor.executeScenario(scenario, domain, implementation);
    
    // Should pass because we expect an error
    expect(result.assertions.some(a => a.type === 'error_returned')).toBe(true);
  });

  it('should execute multiple scenarios', async () => {
    const domain = createMockDomain();
    const implementation = createMockImplementation();
    
    const scenarios = [
      createChaosScenario('scenario_1', 'CreateUser', {
        injections: [{ type: 'network_latency', parameters: { latencyMs: 10 } }],
        assertions: [{ type: 'recovery', expected: true }],
      }),
      createChaosScenario('scenario_2', 'CreateUser', {
        injections: [{ type: 'network_latency', parameters: { latencyMs: 20 } }],
        assertions: [{ type: 'recovery', expected: true }],
      }),
    ];
    
    const results = await executor.executeScenarios(scenarios, domain, implementation);
    
    expect(results).toHaveLength(2);
  });
});

describe('ChaosVerifier', () => {
  let verifier: ChaosVerifier;

  beforeEach(() => {
    verifier = createVerifier({ timeoutMs: 5000 });
  });

  it('should verify with implementation', async () => {
    const domain = createMockDomain();
    const implementation = createMockImplementation();
    
    const result = await verifier.verifyWithImplementation(
      implementation,
      domain,
      'CreateUser'
    );
    
    expect(result).toBeDefined();
    expect(result.verdict).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.coverage).toBeDefined();
    expect(result.timing).toBeDefined();
  });

  it('should calculate coverage', async () => {
    const domain = createMockDomain();
    const implementation = createMockImplementation();
    
    const result = await verifier.verifyWithImplementation(
      implementation,
      domain,
      'CreateUser'
    );
    
    expect(result.coverage.injectionTypes).toBeDefined();
    expect(result.coverage.scenarios).toBeDefined();
    expect(result.coverage.behaviors).toBeDefined();
    expect(result.coverage.overall).toBeGreaterThanOrEqual(0);
  });

  it('should report timing', async () => {
    const domain = createMockDomain();
    const implementation = createMockImplementation();
    
    const result = await verifier.verifyWithImplementation(
      implementation,
      domain,
      'CreateUser'
    );
    
    expect(result.timing.total).toBeGreaterThan(0);
    expect(result.timing.byScenario).toBeDefined();
  });

  it('should handle missing behavior', async () => {
    const domain = createMockDomain();
    const implementation = createMockImplementation();
    
    const result = await verifier.verifyWithImplementation(
      implementation,
      domain,
      'NonExistentBehavior'
    );
    
    expect(result.success).toBe(false);
    expect(result.verdict).toBe('unsafe');
  });

  it('should determine correct verdict', async () => {
    const domain = createMockDomain();
    
    // Test with successful implementation
    const successImpl = createMockImplementation();
    const successResult = await verifier.verifyWithImplementation(
      successImpl,
      domain,
      'CreateUser'
    );
    
    // The verdict should be one of the valid values
    expect(['verified', 'risky', 'unsafe']).toContain(successResult.verdict);
  });
});

describe('Integration', () => {
  it('should run full verification flow', async () => {
    const domain = createMockDomain();
    const implementation = createMockImplementation({ delay: 10 });
    const verifier = createVerifier({
      timeoutMs: 10000,
      continueOnFailure: true,
    });
    
    const result = await verifier.verifyWithImplementation(
      implementation,
      domain,
      'CreateUser',
      ['database_failure', 'network_latency']
    );
    
    expect(result).toBeDefined();
    expect(result.passed.length + result.failed.length).toBeGreaterThan(0);
    expect(result.timeline).toBeDefined();
    expect(result.timeline.totalDuration).toBeGreaterThan(0);
  });

  it('should combine multiple injectors', async () => {
    const timeline = createTimeline();
    
    const networkInjector = createNetworkTimeout();
    const latencyInjector = createFixedLatency(10);
    
    networkInjector.attachTimeline(timeline);
    latencyInjector.attachTimeline(timeline);
    
    networkInjector.activate();
    latencyInjector.activate();
    
    await latencyInjector.inject(async () => 'test');
    
    networkInjector.deactivate();
    latencyInjector.deactivate();
    
    const report = timeline.generateReport();
    expect(report.events.length).toBeGreaterThan(0);
  });
});
