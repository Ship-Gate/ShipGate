/**
 * Chaos Verifier Tests
 *
 * Verifies the full chaos-verification lifecycle:
 *   - Scenario parsing
 *   - Injector creation (all 10 types)
 *   - Execution engine
 *   - Report generation
 *   - Proof bundle output + integrity
 *   - Timeline JSON output
 */

import { describe, it, expect } from 'vitest';
import type { DomainDeclaration } from '@isl-lang/isl-core';

import {
  ChaosEngine,
  createEngine,
  parseChaosScenarios,
  createChaosScenario,
  getSupportedInjectionTypes,
  validateScenario,
  ChaosExecutor,
  createTimeline,
  generateChaosReport,
  buildProofBundle,
  serialiseProofBundle,
  verifyProofIntegrity,
  NetworkInjector,
  DatabaseInjector,
  LatencyInjector,
  ConcurrentInjector,
  RateLimitInjector,
  CpuPressureInjector,
  MemoryPressureInjector,
  ClockSkewInjector,
  type BehaviorImplementation,
} from '../src/index.js';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */

function makeDomain(behaviorNames: string[] = ['CreateOrder']): DomainDeclaration {
  return {
    kind: 'DomainDeclaration',
    name: { kind: 'Identifier', name: 'TestDomain' },
    types: [],
    behaviors: behaviorNames.map((name) => ({
      kind: 'BehaviorDeclaration',
      name: { kind: 'Identifier', name },
      input: { kind: 'TypeDeclaration', name: { kind: 'Identifier', name: `${name}Input` }, fields: [] },
      output: { kind: 'TypeDeclaration', name: { kind: 'Identifier', name: `${name}Output` }, fields: [] },
      preconditions: [],
      postconditions: [],
      invariants: [],
      errors: [],
    })),
    invariants: [],
    events: [],
  } as unknown as DomainDeclaration;
}

function makeImpl(succeed = true): BehaviorImplementation {
  return {
    async execute() {
      if (!succeed) throw new Error('Simulated failure');
      return { success: true, data: 'ok' };
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Scenario parsing                                                  */
/* ------------------------------------------------------------------ */

describe('Scenario Parsing', () => {
  it('parses default chaos scenarios for a behavior', () => {
    const domain = makeDomain();
    const result = parseChaosScenarios(domain, 'CreateOrder');

    expect(result.success).toBe(true);
    expect(result.scenarios.length).toBeGreaterThanOrEqual(4);
    expect(result.scenarios.map((s) => s.name)).toContain(
      'CreateOrder_database_failure',
    );
    expect(result.scenarios.map((s) => s.name)).toContain(
      'CreateOrder_cpu_pressure',
    );
  });

  it('returns all supported injection types', () => {
    const types = getSupportedInjectionTypes();
    expect(types).toContain('database_failure');
    expect(types).toContain('cpu_pressure');
    expect(types).toContain('memory_pressure');
    expect(types).toContain('clock_skew');
    expect(types.length).toBe(10);
  });

  it('creates a custom scenario', () => {
    const scenario = createChaosScenario('custom_test', 'MyBehavior', {
      injections: [{ type: 'network_latency', parameters: { latencyMs: 3000 } }],
      assertions: [{ type: 'timeout', expected: false }],
    });

    expect(scenario.name).toBe('custom_test');
    expect(scenario.injections).toHaveLength(1);
    expect(scenario.assertions).toHaveLength(1);
  });

  it('validates a scenario against a domain', () => {
    const domain = makeDomain();
    const scenario = createChaosScenario('test', 'CreateOrder', {
      injections: [{ type: 'database_failure', parameters: {} }],
    });

    const errors = validateScenario(scenario, domain);
    expect(errors).toHaveLength(0);
  });

  it('reports validation error for missing behavior', () => {
    const domain = makeDomain();
    const scenario = createChaosScenario('test', 'NonExistent', {
      injections: [{ type: 'database_failure', parameters: {} }],
    });

    const errors = validateScenario(scenario, domain);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('NonExistent');
  });
});

/* ------------------------------------------------------------------ */
/*  Injectors                                                         */
/* ------------------------------------------------------------------ */

describe('Injectors', () => {
  it('creates and activates a NetworkInjector', () => {
    const injector = new NetworkInjector({ failureType: 'timeout' });
    const timeline = createTimeline();
    injector.attachTimeline(timeline);
    injector.activate();

    expect(injector.getState().active).toBe(true);

    injector.deactivate();
    expect(injector.getState().active).toBe(false);
  });

  it('creates and activates a DatabaseInjector', () => {
    const injector = new DatabaseInjector({ failureType: 'unavailable' });
    injector.activate();
    expect(injector.getState().active).toBe(true);
    injector.deactivate();
  });

  it('creates and activates a LatencyInjector', () => {
    const injector = new LatencyInjector({ latencyMs: 100 });
    injector.activate();
    expect(injector.getState().active).toBe(true);
    injector.deactivate();
  });

  it('creates and activates a ConcurrentInjector', () => {
    const injector = new ConcurrentInjector({ concurrency: 5 });
    injector.activate();
    expect(injector.getState().active).toBe(true);
    injector.deactivate();
  });

  it('creates and activates a RateLimitInjector', () => {
    const injector = new RateLimitInjector({
      requestsPerWindow: 10,
      windowMs: 1000,
    });
    injector.activate();
    expect(injector.getState().active).toBe(true);
    injector.deactivate();
  });

  it('creates and activates a CpuPressureInjector', () => {
    const injector = new CpuPressureInjector({
      percentage: 50,
      durationMs: 100,
    });
    injector.activate();
    expect(injector.getState().active).toBe(true);
    injector.deactivate();
  });

  it('creates and activates a MemoryPressureInjector', () => {
    const injector = new MemoryPressureInjector({ allocationMb: 1 });
    injector.activate();
    expect(injector.getState().active).toBe(true);
    expect(injector.getState().allocatedMb).toBeGreaterThan(0);
    injector.deactivate();
    expect(injector.getState().allocatedMb).toBe(0);
  });

  it('creates and activates a ClockSkewInjector', () => {
    const injector = new ClockSkewInjector({ offsetMs: 5000, mode: 'fixed' });
    const realNow = Date.now();
    injector.activate();

    const skewedNow = Date.now();
    expect(skewedNow).toBeGreaterThanOrEqual(realNow + 4000);

    injector.deactivate();
    const restored = Date.now();
    // After deactivation, Date.now should be back to normal (within tolerance)
    expect(Math.abs(restored - (realNow + 100))).toBeLessThan(2000);
  });
});

/* ------------------------------------------------------------------ */
/*  Executor                                                          */
/* ------------------------------------------------------------------ */

describe('ChaosExecutor', () => {
  it('executes a single scenario', async () => {
    const domain = makeDomain();
    const impl = makeImpl(false); // will throw

    const scenario = createChaosScenario('db_fail', 'CreateOrder', {
      injections: [{ type: 'database_failure', parameters: { failureType: 'unavailable' } }],
      assertions: [{ type: 'error_returned', expected: true, message: 'Should fail' }],
    });

    const executor = new ChaosExecutor({ timeoutMs: 5000 });
    const result = await executor.executeScenario(scenario, domain, impl);

    expect(result.name).toBe('db_fail');
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.injections.length).toBeGreaterThanOrEqual(1);
    expect(result.timeline.events.length).toBeGreaterThan(0);
  });

  it('executes multiple scenarios with continueOnFailure', async () => {
    const domain = makeDomain();
    const impl = makeImpl(true);

    const scenarios = [
      createChaosScenario('s1', 'CreateOrder', {
        injections: [{ type: 'network_latency', parameters: { latencyMs: 10 } }],
        assertions: [{ type: 'timeout', expected: false }],
      }),
      createChaosScenario('s2', 'CreateOrder', {
        injections: [{ type: 'database_failure', parameters: {} }],
        assertions: [{ type: 'error_returned', expected: true }],
      }),
    ];

    const executor = new ChaosExecutor({ continueOnFailure: true, timeoutMs: 5000 });
    const results = await executor.executeScenarios(scenarios, domain, impl);

    expect(results.length).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
/*  Engine                                                            */
/* ------------------------------------------------------------------ */

describe('ChaosEngine', () => {
  it('runs the full lifecycle', async () => {
    const domain = makeDomain();
    const impl = makeImpl(true);

    const engine = createEngine({
      timeoutMs: 5000,
      continueOnFailure: true,
    });

    const result = await engine.run(domain, impl, 'CreateOrder');

    expect(result.scenarios.length).toBeGreaterThan(0);
    expect(result.report.version).toBe('1.0.0');
    expect(result.proof.version).toBe('1.0.0');
    expect(result.timeline.events.length).toBeGreaterThan(0);
    expect(typeof result.score).toBe('number');
    expect(['verified', 'risky', 'unsafe']).toContain(result.verdict);
  });

  it('returns empty result when no scenarios match', async () => {
    const domain = makeDomain();
    const impl = makeImpl(true);

    const engine = createEngine({
      scenarioFilter: ['nonexistent_scenario_xyz'],
    });

    const result = await engine.run(domain, impl, 'CreateOrder');

    expect(result.success).toBe(true);
    expect(result.scenarios.length).toBe(0);
  });

  it('supports parallel execution', async () => {
    const domain = makeDomain();
    const impl = makeImpl(true);

    const engine = createEngine({
      parallel: true,
      parallelLimit: 2,
      timeoutMs: 5000,
      continueOnFailure: true,
    });

    const result = await engine.run(domain, impl, 'CreateOrder');
    expect(result.scenarios.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Report                                                            */
/* ------------------------------------------------------------------ */

describe('Report Generator', () => {
  it('generates a structured report', () => {
    const domain = makeDomain();
    const scenarios = parseChaosScenarios(domain, 'CreateOrder').scenarios;

    const mockResults = scenarios.slice(0, 2).map((s, i) => ({
      name: s.name,
      passed: i === 0,
      duration: 100 + i * 50,
      injections: s.injections.map((inj) => ({
        type: inj.type,
        activated: true,
        deactivated: true,
        stats: {},
      })),
      assertions: s.assertions.map((a) => ({
        type: a.type,
        passed: i === 0,
        expected: a.expected,
        message: a.message,
      })),
      timeline: {
        events: [],
        startTime: Date.now(),
        endTime: Date.now() + 100,
        totalDuration: 100,
        injectionCount: 1,
        errorCount: i === 0 ? 0 : 1,
        recoveryCount: 0,
      },
    }));

    const report = generateChaosReport(mockResults, scenarios, domain, 500);

    expect(report.version).toBe('1.0.0');
    expect(report.domainName).toBe('TestDomain');
    expect(report.summary.totalScenarios).toBe(scenarios.length);
    expect(report.summary.passed).toBe(1);
    expect(report.summary.failed).toBe(1);
    expect(report.coverage.injectionTypes.length).toBe(10);
    expect(report.timing.totalMs).toBe(500);
    expect(report.injectionStats.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Proof Bundle                                                      */
/* ------------------------------------------------------------------ */

describe('Proof Bundle', () => {
  it('builds a proof bundle with integrity hash', () => {
    const domain = makeDomain();
    const scenarios = parseChaosScenarios(domain, 'CreateOrder').scenarios;

    const report = generateChaosReport([], scenarios, domain, 100);
    const timeline = createTimeline().generateReport();
    const bundle = buildProofBundle(report, timeline);

    expect(bundle.version).toBe('1.0.0');
    expect(bundle.bundleId).toBeTruthy();
    expect(bundle.integrityHash).toBeTruthy();
    expect(['PROVEN', 'INCOMPLETE_PROOF', 'FAILED']).toContain(bundle.verdict);
  });

  it('serialises and verifies integrity', () => {
    const domain = makeDomain();
    const scenarios = parseChaosScenarios(domain, 'CreateOrder').scenarios;

    const report = generateChaosReport([], scenarios, domain, 100);
    const timeline = createTimeline().generateReport();
    const bundle = buildProofBundle(report, timeline);

    const json = serialiseProofBundle(bundle);
    expect(typeof json).toBe('string');

    const parsed = JSON.parse(json);
    expect(verifyProofIntegrity(parsed)).toBe(true);
  });

  it('detects tampered proof bundles', () => {
    const domain = makeDomain();
    const scenarios = parseChaosScenarios(domain, 'CreateOrder').scenarios;

    const report = generateChaosReport([], scenarios, domain, 100);
    const timeline = createTimeline().generateReport();
    const bundle = buildProofBundle(report, timeline);

    // Tamper with the bundle
    bundle.verdict = 'PROVEN';
    expect(verifyProofIntegrity(bundle)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Timeline                                                          */
/* ------------------------------------------------------------------ */

describe('Timeline', () => {
  it('records events and generates report', () => {
    const tl = createTimeline();
    tl.record('injection_start', { injector: 'network' });
    tl.record('behavior_start', { behavior: 'CreateOrder' });
    tl.record('error', { message: 'timeout' });
    tl.recordRecovery('network', { retries: 3 });

    const report = tl.generateReport();

    expect(report.events.length).toBe(4);
    expect(report.injectionCount).toBe(1);
    expect(report.errorCount).toBe(1);
    expect(report.recoveryCount).toBe(1);
  });

  it('supports duration-based events', () => {
    const tl = createTimeline();
    const id = tl.startEvent('behavior_start', { behavior: 'test' });
    tl.endEvent(id, { result: 'success' });

    const report = tl.generateReport();
    const evt = report.events.find((e) => e.id === id);
    expect(evt).toBeTruthy();
    expect(evt!.duration).toBeDefined();
  });

  it('formats as human-readable string', () => {
    const tl = createTimeline();
    tl.record('injection_start', { injector: 'database' });
    tl.record('behavior_end', { result: 'pass' });

    const formatted = tl.format();
    expect(formatted).toContain('Chaos Timeline');
    expect(formatted).toContain('injection_start');
    expect(formatted).toContain('Summary');
  });

  it('produces JSON-serialisable output', () => {
    const tl = createTimeline();
    tl.record('injection_start', {});
    tl.record('error', { msg: 'boom' });

    const report = tl.generateReport();
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json);

    expect(parsed.events).toHaveLength(2);
    expect(typeof parsed.totalDuration).toBe('number');
  });
});
