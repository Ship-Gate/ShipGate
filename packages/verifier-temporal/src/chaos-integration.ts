/**
 * Chaos Testing Integration for Temporal Verification
 * 
 * Integrates temporal property verification with chaos testing scenarios.
 * Enables verification that temporal properties hold even under fault injection.
 * 
 * @module @isl-lang/verifier-temporal/chaos-integration
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

/**
 * Chaos scenario configuration for temporal verification
 */
export interface ChaosTemporalScenario {
  /** Scenario name */
  name: string;
  /** Fault injection type */
  injectionType: ChaosInjectionType;
  /** Temporal properties to verify */
  temporalProperties: TemporalPropertySpec[];
  /** Expected behavior under chaos */
  expectedBehavior: 'maintain' | 'degrade_gracefully' | 'recover';
  /** Recovery time bound in ms (for recovery scenarios) */
  recoveryBoundMs?: number;
}

/**
 * Types of chaos/fault injection
 */
export type ChaosInjectionType =
  | 'network_latency'
  | 'network_partition'
  | 'service_unavailable'
  | 'database_failure'
  | 'resource_exhaustion'
  | 'concurrent_requests'
  | 'message_loss'
  | 'clock_skew'
  | 'slow_consumer'
  | 'crash_recovery';

/**
 * Specification for a temporal property to verify
 */
export interface TemporalPropertySpec {
  /** Property identifier */
  id: string;
  /** Property type */
  type: 'always' | 'eventually' | 'never' | 'within' | 'leads_to';
  /** Property description */
  description: string;
  /** Event kind to check */
  eventKind?: string;
  /** Time bound in ms */
  boundMs?: number;
  /** Predicate function (optional, for custom checks) */
  predicate?: StatePredicate;
  /** Response event kind (for leads_to) */
  responseEventKind?: string;
}

/**
 * Result of temporal verification under chaos
 */
export interface ChaosTemporalResult {
  /** Scenario name */
  scenarioName: string;
  /** Injection type used */
  injectionType: ChaosInjectionType;
  /** Overall success */
  success: boolean;
  /** Verdict */
  verdict: 'RESILIENT' | 'DEGRADED' | 'VIOLATED' | 'UNKNOWN';
  /** Individual property results */
  propertyResults: TemporalPropertyResult[];
  /** Number of traces analyzed */
  tracesAnalyzed: number;
  /** Total snapshots checked */
  totalSnapshots: number;
  /** Confidence score */
  confidence: number;
  /** Recovery metrics (if applicable) */
  recoveryMetrics?: RecoveryMetrics;
  /** Timing statistics */
  timing: {
    totalMs: number;
    verificationMs: number;
  };
}

/**
 * Result for a single temporal property
 */
export interface TemporalPropertyResult {
  /** Property ID */
  propertyId: string;
  /** Property description */
  description: string;
  /** Whether property held */
  success: boolean;
  /** Evaluation result */
  evaluation: TemporalEvaluationResult;
  /** Violation details (if any) */
  violation?: {
    snapshotIndex: number;
    timestampMs: number;
    event?: TraceEvent;
  };
}

/**
 * Metrics for recovery verification
 */
export interface RecoveryMetrics {
  /** Whether system recovered */
  recovered: boolean;
  /** Time to recovery in ms */
  recoveryTimeMs?: number;
  /** Whether recovery was within bound */
  withinBound: boolean;
  /** Number of recovery attempts */
  recoveryAttempts: number;
}

// ============================================================================
// CHAOS TEMPORAL VERIFIER
// ============================================================================

/**
 * Verify temporal properties under chaos scenarios
 * 
 * @param traces - Traces collected during chaos testing
 * @param scenario - Chaos scenario configuration
 * @returns Verification result
 * 
 * @example
 * ```typescript
 * const result = await verifyChaosTemporalProperties(
 *   chaosTraces,
 *   {
 *     name: 'database_failure_resilience',
 *     injectionType: 'database_failure',
 *     temporalProperties: [
 *       { id: 'no_data_loss', type: 'never', eventKind: 'data_loss' },
 *       { id: 'graceful_error', type: 'always', eventKind: 'graceful_degradation' },
 *     ],
 *     expectedBehavior: 'degrade_gracefully',
 *   }
 * );
 * ```
 */
export function verifyChaosTemporalProperties(
  traces: Trace[],
  scenario: ChaosTemporalScenario
): ChaosTemporalResult {
  const startTime = Date.now();
  const propertyResults: TemporalPropertyResult[] = [];
  let totalSnapshots = 0;
  
  // Build temporal traces
  const temporalTraces = traces.map(buildTemporalTrace);
  
  // Verify each temporal property
  for (const propSpec of scenario.temporalProperties) {
    const result = verifyTemporalProperty(temporalTraces, propSpec);
    propertyResults.push(result);
    totalSnapshots += result.evaluation.snapshotsEvaluated;
  }
  
  // Calculate recovery metrics if applicable
  let recoveryMetrics: RecoveryMetrics | undefined;
  if (scenario.expectedBehavior === 'recover') {
    recoveryMetrics = calculateRecoveryMetrics(
      temporalTraces,
      scenario.injectionType,
      scenario.recoveryBoundMs
    );
  }
  
  // Determine overall verdict
  const verdict = determineVerdict(
    propertyResults,
    scenario.expectedBehavior,
    recoveryMetrics
  );
  
  // Calculate confidence
  const confidence = calculateConfidence(propertyResults, totalSnapshots);
  
  const verificationTime = Date.now() - startTime;
  
  return {
    scenarioName: scenario.name,
    injectionType: scenario.injectionType,
    success: verdict === 'RESILIENT' || verdict === 'DEGRADED',
    verdict,
    propertyResults,
    tracesAnalyzed: traces.length,
    totalSnapshots,
    confidence,
    recoveryMetrics,
    timing: {
      totalMs: verificationTime,
      verificationMs: verificationTime,
    },
  };
}

/**
 * Verify a single temporal property across traces
 */
function verifyTemporalProperty(
  temporalTraces: TemporalTrace[],
  propSpec: TemporalPropertySpec
): TemporalPropertyResult {
  // Combine all traces for evaluation
  const combinedSnapshots = temporalTraces.flatMap(t => t.snapshots);
  
  // Create a synthetic combined trace for evaluation
  const combinedTrace: TemporalTrace = {
    id: 'combined',
    domain: temporalTraces[0]?.domain ?? 'unknown',
    snapshots: combinedSnapshots,
    durationMs: Math.max(...temporalTraces.map(t => t.durationMs)),
    initialState: temporalTraces[0]?.initialState ?? {},
    finalState: temporalTraces[temporalTraces.length - 1]?.finalState ?? {},
    events: temporalTraces.flatMap(t => t.events),
  };
  
  // Create predicate from spec
  const predicate = propSpec.predicate ?? createPredicateFromSpec(propSpec);
  
  let evaluation: TemporalEvaluationResult;
  
  switch (propSpec.type) {
    case 'always':
      evaluation = evaluateAlways(combinedTrace, predicate, {
        description: propSpec.description,
      });
      break;
      
    case 'eventually':
      evaluation = evaluateEventually(combinedTrace, predicate, {
        description: propSpec.description,
        boundMs: propSpec.boundMs,
      });
      break;
      
    case 'never':
      evaluation = evaluateNever(combinedTrace, predicate, {
        description: propSpec.description,
      });
      break;
      
    case 'leads_to':
      if (propSpec.responseEventKind) {
        const responsePredicate = createEventPredicate(propSpec.responseEventKind);
        evaluation = evaluateLeadsTo(combinedTrace, predicate, responsePredicate, {
          description: propSpec.description,
          responseWindowMs: propSpec.boundMs,
        });
      } else {
        evaluation = {
          satisfied: false,
          verdict: 'UNKNOWN',
          snapshotsEvaluated: 0,
          confidence: 0,
          explanation: 'Missing responseEventKind for leads_to property',
        };
      }
      break;
      
    case 'within':
      evaluation = evaluateEventually(combinedTrace, predicate, {
        description: propSpec.description,
        boundMs: propSpec.boundMs ?? 1000,
      });
      break;
      
    default:
      evaluation = {
        satisfied: false,
        verdict: 'UNKNOWN',
        snapshotsEvaluated: 0,
        confidence: 0,
        explanation: `Unknown property type: ${propSpec.type}`,
      };
  }
  
  return {
    propertyId: propSpec.id,
    description: propSpec.description,
    success: evaluation.satisfied,
    evaluation,
    violation: evaluation.witnessSnapshot && !evaluation.satisfied ? {
      snapshotIndex: evaluation.violationIndex ?? 0,
      timestampMs: evaluation.witnessTimeMs ?? 0,
      event: evaluation.witnessSnapshot.causingEvent,
    } : undefined,
  };
}

/**
 * Create a predicate from a property specification
 */
function createPredicateFromSpec(spec: TemporalPropertySpec): StatePredicate {
  if (spec.eventKind) {
    return createEventPredicate(spec.eventKind);
  }
  
  // Default: always true (no specific check)
  return () => true;
}

/**
 * Create a predicate that checks for event occurrence
 */
function createEventPredicate(eventKind: string): StatePredicate {
  return (_state: Record<string, unknown>, event?: TraceEvent) => event?.kind === eventKind;
}

/**
 * Calculate recovery metrics from traces
 */
function calculateRecoveryMetrics(
  traces: TemporalTrace[],
  injectionType: ChaosInjectionType,
  recoveryBoundMs?: number
): RecoveryMetrics {
  let recovered = false;
  let recoveryTimeMs: number | undefined;
  let recoveryAttempts = 0;
  
  for (const trace of traces) {
    // Look for fault injection and subsequent recovery events
    let faultTime: number | undefined;
    let recoveryTime: number | undefined;
    
    for (const snapshot of trace.snapshots) {
      const event = snapshot.causingEvent;
      if (!event) continue;
      
      // Detect fault injection
      if (isFaultEvent(event, injectionType)) {
        faultTime = snapshot.timestampMs;
        recoveryAttempts++;
      }
      
      // Detect recovery
      if (faultTime !== undefined && isRecoveryEvent(event)) {
        recoveryTime = snapshot.timestampMs;
        recovered = true;
        recoveryTimeMs = recoveryTime !== undefined ? recoveryTime - faultTime : undefined;
        break;
      }
    }
  }
  
  return {
    recovered,
    recoveryTimeMs,
    withinBound: recoveryBoundMs !== undefined 
      ? (recoveryTimeMs ?? Infinity) <= recoveryBoundMs 
      : true,
    recoveryAttempts,
  };
}

/**
 * Check if event represents a fault injection
 */
function isFaultEvent(event: TraceEvent, injectionType: ChaosInjectionType): boolean {
  // Check for chaos injection markers
  if (event.metadata?.chaosInjection === injectionType) return true;
  if (event.kind === 'handler_error' && event.metadata?.injected) return true;
  
  // Check for specific error patterns
  const errorCode = (event.outputs as Record<string, unknown>)?.error as Record<string, unknown> | undefined;
  if (errorCode?.code) {
    const code = String(errorCode.code);
    switch (injectionType) {
      case 'database_failure':
        return code.includes('DB_') || code.includes('DATABASE');
      case 'network_latency':
      case 'network_partition':
        return code.includes('NETWORK') || code.includes('TIMEOUT');
      case 'service_unavailable':
        return code.includes('SERVICE_') || code.includes('UNAVAILABLE');
      default:
        return false;
    }
  }
  
  return false;
}

/**
 * Check if event represents recovery
 */
function isRecoveryEvent(event: TraceEvent): boolean {
  return (
    event.kind === 'handler_return' ||
    event.metadata?.recovered === true ||
    event.kind === 'state_change' && event.outputs?.newValue === 'healthy'
  );
}

/**
 * Determine overall verification verdict
 */
function determineVerdict(
  propertyResults: TemporalPropertyResult[],
  expectedBehavior: 'maintain' | 'degrade_gracefully' | 'recover',
  recoveryMetrics?: RecoveryMetrics
): 'RESILIENT' | 'DEGRADED' | 'VIOLATED' | 'UNKNOWN' {
  const allPassed = propertyResults.every(r => r.success);
  const somePassed = propertyResults.some(r => r.success);
  const anyUnknown = propertyResults.some(r => r.evaluation.verdict === 'UNKNOWN');
  
  if (anyUnknown && !allPassed) {
    return 'UNKNOWN';
  }
  
  switch (expectedBehavior) {
    case 'maintain':
      return allPassed ? 'RESILIENT' : 'VIOLATED';
      
    case 'degrade_gracefully':
      if (allPassed) return 'RESILIENT';
      if (somePassed) return 'DEGRADED';
      return 'VIOLATED';
      
    case 'recover':
      if (!recoveryMetrics?.recovered) return 'VIOLATED';
      if (!recoveryMetrics.withinBound) return 'DEGRADED';
      return allPassed ? 'RESILIENT' : 'DEGRADED';
      
    default:
      return 'UNKNOWN';
  }
}

/**
 * Calculate overall confidence score
 */
function calculateConfidence(
  results: TemporalPropertyResult[],
  totalSnapshots: number
): number {
  if (results.length === 0) return 0;
  
  // Average confidence from all property evaluations
  const avgPropertyConfidence = results.reduce(
    (sum, r) => sum + r.evaluation.confidence,
    0
  ) / results.length;
  
  // Bonus for more snapshots
  const snapshotBonus = Math.min(totalSnapshots / 100, 1) * 10;
  
  return Math.min(100, Math.round(avgPropertyConfidence + snapshotBonus));
}

// ============================================================================
// PREDEFINED CHAOS SCENARIOS
// ============================================================================

/**
 * Create a database failure resilience scenario
 */
export function createDatabaseFailureScenario(
  additionalProperties: TemporalPropertySpec[] = []
): ChaosTemporalScenario {
  return {
    name: 'database_failure_resilience',
    injectionType: 'database_failure',
    temporalProperties: [
      {
        id: 'no_data_corruption',
        type: 'never',
        description: 'Data corruption should never occur',
        eventKind: 'data_corruption',
      },
      {
        id: 'graceful_error_handling',
        type: 'always',
        description: 'Errors should be handled gracefully',
        predicate: (_state: Record<string, unknown>, event?: TraceEvent) => {
          if (event?.kind !== 'handler_error') return true;
          const outputs = event.outputs as Record<string, unknown>;
          const error = outputs?.error as Record<string, unknown> | undefined;
          return error?.code !== 'UNHANDLED_ERROR';
        },
      },
      ...additionalProperties,
    ],
    expectedBehavior: 'degrade_gracefully',
  };
}

/**
 * Create a network partition resilience scenario
 */
export function createNetworkPartitionScenario(
  recoveryBoundMs = 30000,
  additionalProperties: TemporalPropertySpec[] = []
): ChaosTemporalScenario {
  return {
    name: 'network_partition_resilience',
    injectionType: 'network_partition',
    temporalProperties: [
      {
        id: 'no_split_brain',
        type: 'never',
        description: 'Split-brain condition should never occur',
        eventKind: 'split_brain',
      },
      {
        id: 'eventual_consistency',
        type: 'eventually',
        description: 'System should eventually become consistent',
        eventKind: 'consistency_restored',
        boundMs: recoveryBoundMs,
      },
      ...additionalProperties,
    ],
    expectedBehavior: 'recover',
    recoveryBoundMs,
  };
}

/**
 * Create a concurrent requests stress scenario
 */
export function createConcurrentRequestsScenario(
  maxLatencyMs = 1000,
  additionalProperties: TemporalPropertySpec[] = []
): ChaosTemporalScenario {
  return {
    name: 'concurrent_requests_stress',
    injectionType: 'concurrent_requests',
    temporalProperties: [
      {
        id: 'no_deadlock',
        type: 'never',
        description: 'Deadlock should never occur',
        eventKind: 'deadlock_detected',
      },
      {
        id: 'bounded_latency',
        type: 'always',
        description: `Response latency should stay within ${maxLatencyMs}ms`,
        predicate: (_state: Record<string, unknown>, event?: TraceEvent) => {
          if (event?.kind !== 'handler_return') return true;
          const timing = event.timing;
          if (!timing?.durationMs) return true;
          return timing.durationMs <= maxLatencyMs;
        },
      },
      {
        id: 'no_race_condition',
        type: 'never',
        description: 'Race conditions should not cause data inconsistency',
        eventKind: 'race_condition',
      },
      ...additionalProperties,
    ],
    expectedBehavior: 'maintain',
  };
}

// ============================================================================
// BATCH VERIFICATION
// ============================================================================

/**
 * Run multiple chaos scenarios and aggregate results
 */
export function verifyChaosScenarioBatch(
  traces: Trace[],
  scenarios: ChaosTemporalScenario[]
): {
  overallSuccess: boolean;
  results: ChaosTemporalResult[];
  summary: {
    total: number;
    resilient: number;
    degraded: number;
    violated: number;
    unknown: number;
  };
} {
  const results = scenarios.map(scenario => 
    verifyChaosTemporalProperties(traces, scenario)
  );
  
  const summary = {
    total: results.length,
    resilient: results.filter(r => r.verdict === 'RESILIENT').length,
    degraded: results.filter(r => r.verdict === 'DEGRADED').length,
    violated: results.filter(r => r.verdict === 'VIOLATED').length,
    unknown: results.filter(r => r.verdict === 'UNKNOWN').length,
  };
  
  return {
    overallSuccess: summary.violated === 0 && summary.unknown === 0,
    results,
    summary,
  };
}
