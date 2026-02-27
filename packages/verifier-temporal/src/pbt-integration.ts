/**
 * Property-Based Testing Integration for Temporal Verification
 * 
 * Integrates temporal property verification with PBT to discover
 * temporal violations through randomized testing.
 * 
 * @module @isl-lang/verifier-temporal/pbt-integration
 */

import type { Trace, TraceEvent } from '@isl-lang/trace-format';
import {
  buildTemporalTrace,
  evaluateAlways,
  evaluateEventually,
  evaluateNever,
  evaluateLeadsTo,
  type TemporalTrace,
  type StatePredicate,
  type TemporalEvaluationResult,
} from './trace-model.js';

// ============================================================================
// TYPES
// ============================================================================

export interface TemporalProperty {
  id: string;
  name: string;
  type: 'always' | 'eventually' | 'never' | 'within' | 'leads_to';
  predicate: StatePredicate;
  boundMs?: number;
  responsePredicate?: StatePredicate;
  responseWindowMs?: number;
}

export interface TemporalPBTConfig {
  numTests: number;
  seed?: number;
  maxTraceLength: number;
  minTraceLength: number;
  maxTimeSpanMs: number;
  shrinking: boolean;
  maxShrinkAttempts: number;
}

export const DEFAULT_CONFIG: TemporalPBTConfig = {
  numTests: 100,
  maxTraceLength: 50,
  minTraceLength: 5,
  maxTimeSpanMs: 10000,
  shrinking: true,
  maxShrinkAttempts: 100,
};

export interface TemporalPBTResult {
  success: boolean;
  testsRun: number;
  testsPassed: number;
  firstFailure?: TemporalPBTFailure;
  shrunkFailure?: TemporalPBTFailure;
  stats: { iterations: number; successes: number; failures: number; shrinkAttempts: number; avgTraceLength: number };
  seed: number;
  totalDurationMs: number;
}

export interface TemporalPBTFailure {
  propertyId: string;
  trace: TemporalTrace;
  evaluation: TemporalEvaluationResult;
  iteration: number;
  traceSize: number;
}

export type TraceGenerator = (seed: number, size: number, config: TemporalPBTConfig) => Trace;

// Simple PRNG
class PRNG {
  private state: number;
  constructor(seed: number) { this.state = seed; }
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

/**
 * Run property-based tests for temporal properties
 */
export function runTemporalPBT(
  properties: TemporalProperty[],
  generator: TraceGenerator,
  config: Partial<TemporalPBTConfig> = {}
): TemporalPBTResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  const seed = cfg.seed ?? Date.now();
  const prng = new PRNG(seed);
  
  let testsRun = 0, testsPassed = 0, totalLen = 0;
  let firstFailure: TemporalPBTFailure | undefined;
  
  for (let i = 0; i < cfg.numTests && !firstFailure; i++) {
    testsRun++;
    const size = cfg.minTraceLength + Math.floor((i / cfg.numTests) * (cfg.maxTraceLength - cfg.minTraceLength));
    const trace = generator(prng.nextInt(0, 0xffffffff), size, cfg);
    const temporalTrace = buildTemporalTrace(trace);
    totalLen += temporalTrace.snapshots.length;
    
    for (const prop of properties) {
      const eval_ = verifyProperty(temporalTrace, prop);
      if (!eval_.satisfied) {
        firstFailure = { propertyId: prop.id, trace: temporalTrace, evaluation: eval_, iteration: i, traceSize: temporalTrace.snapshots.length };
        break;
      }
    }
    if (!firstFailure) testsPassed++;
  }
  
  let shrunkFailure: TemporalPBTFailure | undefined;
  let shrinkAttempts = 0;
  
  if (firstFailure && cfg.shrinking) {
    const sr = shrinkTrace(firstFailure, properties, cfg);
    shrunkFailure = sr.minimal;
    shrinkAttempts = sr.attempts;
  }
  
  return {
    success: !firstFailure,
    testsRun,
    testsPassed,
    firstFailure,
    shrunkFailure,
    stats: { iterations: testsRun, successes: testsPassed, failures: firstFailure ? 1 : 0, shrinkAttempts, avgTraceLength: testsRun > 0 ? totalLen / testsRun : 0 },
    seed,
    totalDurationMs: Date.now() - startTime,
  };
}

function verifyProperty(trace: TemporalTrace, prop: TemporalProperty): TemporalEvaluationResult {
  switch (prop.type) {
    case 'always': return evaluateAlways(trace, prop.predicate, { description: prop.name });
    case 'eventually': return evaluateEventually(trace, prop.predicate, { description: prop.name, boundMs: prop.boundMs });
    case 'never': return evaluateNever(trace, prop.predicate, { description: prop.name });
    case 'within': return evaluateEventually(trace, prop.predicate, { description: prop.name, boundMs: prop.boundMs });
    case 'leads_to':
      if (prop.responsePredicate) return evaluateLeadsTo(trace, prop.predicate, prop.responsePredicate, { description: prop.name, responseWindowMs: prop.responseWindowMs });
      return { satisfied: false, verdict: 'UNKNOWN', snapshotsEvaluated: 0, confidence: 0, explanation: 'leads_to requires responsePredicate' };
    default: return { satisfied: false, verdict: 'UNKNOWN', snapshotsEvaluated: 0, confidence: 0, explanation: `Unknown type: ${prop.type}` };
  }
}

function shrinkTrace(failure: TemporalPBTFailure, properties: TemporalProperty[], config: TemporalPBTConfig): { minimal: TemporalPBTFailure; attempts: number } {
  let current = failure, attempts = 0, lo = 1, hi = current.trace.snapshots.length;
  
  while (lo < hi && attempts < config.maxShrinkAttempts) {
    const mid = Math.floor((lo + hi) / 2);
    attempts++;
    const shrunk = truncateTrace(current.trace, mid);
    const prop = properties.find(p => p.id === failure.propertyId);
    if (prop) {
      const eval_ = verifyProperty(shrunk, prop);
      if (!eval_.satisfied) { current = { ...current, trace: shrunk, evaluation: eval_, traceSize: shrunk.snapshots.length }; hi = mid; }
      else lo = mid + 1;
    } else break;
  }
  return { minimal: current, attempts };
}

function truncateTrace(trace: TemporalTrace, length: number): TemporalTrace {
  const snapshots = trace.snapshots.slice(0, length);
  const last = snapshots[snapshots.length - 1];
  return { ...trace, snapshots, durationMs: last?.timestampMs ?? 0, finalState: last?.state ?? trace.initialState, events: trace.events.slice(0, Math.max(0, length - 1)) };
}

// Trace generators
export function createRandomTraceGenerator(opts: { eventKinds: string[]; stateKeys?: string[]; errorProbability?: number }): TraceGenerator {
  const { eventKinds, stateKeys = [], errorProbability = 0.1 } = opts;
  return (seed, size, config) => {
    const prng = new PRNG(seed);
    const events: TraceEvent[] = [];
    const startTime = new Date();
    let currentTimeMs = 0;
    
    for (let i = 0; i < size; i++) {
      currentTimeMs += prng.nextInt(1, config.maxTimeSpanMs / size);
      const kind = eventKinds[prng.nextInt(0, eventKinds.length - 1)]!;
      const isError = prng.next() < errorProbability;
      const inputs: Record<string, unknown> = {}, outputs: Record<string, unknown> = {};
      for (const key of stateKeys) { inputs[key] = prng.nextInt(0, 100); outputs[key] = prng.nextInt(0, 100); }
      if (isError) outputs.error = { name: 'RandomError', code: 'RANDOM_ERROR' };
      events.push({
        time: new Date(startTime.getTime() + currentTimeMs).toISOString(),
        kind: (isError ? 'handler_error' : kind) as TraceEvent['kind'],
        correlationId: `corr-${seed}-${i}`,
        handler: 'randomHandler',
        inputs, outputs, events: [],
        timing: { startMs: currentTimeMs, durationMs: prng.nextInt(1, 100) },
      });
    }
    return { id: `trace-${seed}`, name: `Random trace`, domain: 'test', startTime: startTime.toISOString(), correlationId: `trace-${seed}`, events, initialState: {} };
  };
}

// Property builders
export const alwaysProperty = (id: string, name: string, predicate: StatePredicate): TemporalProperty => ({ id, name, type: 'always', predicate });
export const eventuallyProperty = (id: string, name: string, predicate: StatePredicate, boundMs?: number): TemporalProperty => ({ id, name, type: 'eventually', predicate, boundMs });
export const neverProperty = (id: string, name: string, predicate: StatePredicate): TemporalProperty => ({ id, name, type: 'never', predicate });
export const withinProperty = (id: string, name: string, predicate: StatePredicate, boundMs: number): TemporalProperty => ({ id, name, type: 'within', predicate, boundMs });
export const leadsToProperty = (id: string, name: string, trigger: StatePredicate, response: StatePredicate, windowMs?: number): TemporalProperty => 
  ({ id, name, type: 'leads_to', predicate: trigger, responsePredicate: response, responseWindowMs: windowMs });

export function formatPBTReport(result: TemporalPBTResult): string {
  const lines = [`TEMPORAL PBT: ${result.success ? '✓ PASSED' : '✗ FAILED'}`, `Tests: ${result.testsPassed}/${result.testsRun}`, `Seed: ${result.seed}`, `Duration: ${result.totalDurationMs}ms`];
  if (result.firstFailure) lines.push(`Failed property: ${result.firstFailure.propertyId}`, `Trace size: ${result.shrunkFailure?.traceSize ?? result.firstFailure.traceSize}`);
  return lines.join('\n');
}
