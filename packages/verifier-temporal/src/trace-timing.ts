/**
 * Trace-Based Timing Extraction
 * 
 * Extracts timing information from trace events for temporal verification.
 * Supports:
 * - Handler duration extraction
 * - Event timestamp extraction
 * - Percentile calculation from collected timings
 * - "eventually within" verification from trace data
 * 
 * @module @isl-lang/verifier-temporal/trace-timing
 */

import type { TraceEvent, Trace, TimingInfo } from '@isl-lang/trace-format';
import { calculatePercentile, calculateLatencyStats, type LatencyStats } from './percentiles.js';
import type { TimingSample } from './timing.js';
import {
  buildTemporalTrace,
  evaluateAlways,
  evaluateNever,
  type StatePredicate,
  type TemporalEvaluationResult,
} from './trace-model.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of a trace-based timing verification
 */
export interface TraceTimingResult {
  /** Whether the timing requirement was met */
  success: boolean;
  /** Verdict for this check */
  verdict: 'PROVEN' | 'NOT_PROVEN' | 'INCOMPLETE_PROOF' | 'UNKNOWN';
  /** Number of samples collected from traces */
  sampleCount: number;
  /** Collected duration samples in ms */
  samples: number[];
  /** Latency statistics if samples available */
  stats?: LatencyStats;
  /** Error message if verification failed */
  error?: string;
  /** Human-readable description */
  description: string;
}

/**
 * Options for trace timing verification
 */
export interface TraceTimingOptions {
  /** Minimum samples required for valid verification */
  minSamples?: number;
  /** Handler name to extract timings from */
  handlerName?: string;
  /** Event kind to match */
  eventKind?: string;
  /** Description for reporting */
  description?: string;
}

/**
 * Timing check specification
 */
export interface TimingCheck {
  /** Threshold in milliseconds */
  thresholdMs: number;
  /** Percentile to check (e.g., 50, 95, 99) */
  percentile: number;
  /** Description of what is being checked */
  description?: string;
}

/**
 * Result of an "eventually within" check
 */
export interface EventuallyWithinResult {
  /** Whether the condition was eventually satisfied within the time bound */
  success: boolean;
  /** Verdict for this check */
  verdict: 'PROVEN' | 'NOT_PROVEN' | 'INCOMPLETE_PROOF';
  /** Time elapsed until condition was satisfied (or timeout) */
  elapsedMs?: number;
  /** The event that satisfied the condition (if found) */
  satisfyingEvent?: TraceEvent;
  /** Error message if failed */
  error?: string;
  /** Description */
  description: string;
}

/**
 * Result of verifying temporal clauses from traces
 */
export interface TemporalClauseResult {
  /** Clause identifier */
  clauseId: string;
  /** Clause type */
  type: 'within' | 'eventually_within' | 'always' | 'never';
  /** Original clause text */
  clauseText: string;
  /** Verification verdict */
  verdict: 'PROVEN' | 'NOT_PROVEN' | 'INCOMPLETE_PROOF' | 'UNKNOWN';
  /** Whether clause was satisfied */
  success: boolean;
  /** Timing details */
  timing?: {
    thresholdMs: number;
    percentile?: number;
    actualMs?: number;
    sampleCount?: number;
  };
  /** Error message if any */
  error?: string;
}

// ============================================================================
// DEFAULT OPTIONS
// ============================================================================

export const DEFAULT_TRACE_TIMING_OPTIONS: Required<Omit<TraceTimingOptions, 'handlerName' | 'eventKind' | 'description'>> = {
  minSamples: 1,
};

// ============================================================================
// TIMING EXTRACTION
// ============================================================================

/**
 * Extract duration timings from trace events
 * 
 * Looks for handler_return events with timing info or calculates
 * duration from handler_call to handler_return pairs.
 * 
 * @param traces - Array of traces to extract from
 * @param options - Extraction options
 * @returns Array of duration samples in milliseconds
 */
export function extractHandlerDurations(
  traces: Trace[],
  options: TraceTimingOptions = {}
): number[] {
  const durations: number[] = [];
  const handlerName = options.handlerName;
  
  for (const trace of traces) {
    for (const event of trace.events) {
      // Skip if handler filter specified and doesn't match
      if (handlerName && event.handler !== handlerName) {
        continue;
      }
      
      // Extract from timing info if available
      if (event.timing?.durationMs !== undefined) {
        durations.push(event.timing.durationMs);
        continue;
      }
      
      // Calculate from start/end timestamps
      if (event.timing?.startMs !== undefined && event.timing?.endMs !== undefined) {
        durations.push(event.timing.endMs - event.timing.startMs);
        continue;
      }
      
      // For handler_return, check outputs.duration
      if (event.kind === 'handler_return' && typeof event.outputs?.duration === 'number') {
        durations.push(event.outputs.duration);
      }
    }
    
    // Also check trace-level metadata duration
    if (!handlerName && trace.metadata?.duration !== undefined) {
      // Only add if we didn't find event-level durations
      if (durations.length === 0) {
        durations.push(trace.metadata.duration);
      }
    }
  }
  
  return durations;
}

/**
 * Extract timing samples from traces as TimingSample objects
 */
export function extractTimingSamples(
  traces: Trace[],
  options: TraceTimingOptions = {}
): TimingSample[] {
  const samples: TimingSample[] = [];
  const handlerName = options.handlerName;
  
  for (const trace of traces) {
    const passed = trace.metadata?.passed ?? true;
    
    for (const event of trace.events) {
      if (handlerName && event.handler !== handlerName) {
        continue;
      }
      
      let duration: number | undefined;
      
      if (event.timing?.durationMs !== undefined) {
        duration = event.timing.durationMs;
      } else if (event.timing?.startMs !== undefined && event.timing?.endMs !== undefined) {
        duration = event.timing.endMs - event.timing.startMs;
      } else if (event.kind === 'handler_return' && typeof event.outputs?.duration === 'number') {
        duration = event.outputs.duration;
      }
      
      if (duration !== undefined) {
        samples.push({
          duration,
          success: passed && event.kind !== 'handler_error',
          result: event.outputs,
        });
      }
    }
  }
  
  return samples;
}

/**
 * Extract event timestamps from traces
 * Returns timestamps in milliseconds relative to trace start
 */
export function extractEventTimestamps(
  traces: Trace[],
  eventKind: string
): Array<{ traceId: string; timestampMs: number; event: TraceEvent }> {
  const timestamps: Array<{ traceId: string; timestampMs: number; event: TraceEvent }> = [];
  
  for (const trace of traces) {
    const traceStart = new Date(trace.startTime).getTime();
    
    for (const event of trace.events) {
      if (event.kind !== eventKind) continue;
      
      let timestampMs: number;
      
      if (event.timing?.startMs !== undefined) {
        timestampMs = event.timing.startMs;
      } else {
        timestampMs = new Date(event.time).getTime() - traceStart;
      }
      
      timestamps.push({
        traceId: trace.id,
        timestampMs,
        event,
      });
    }
  }
  
  return timestamps;
}

// ============================================================================
// PERCENTILE VERIFICATION FROM TRACES
// ============================================================================

/**
 * Verify a "within" timing requirement from traces
 * 
 * Checks that the specified percentile of response times is within the threshold.
 * Returns INCOMPLETE_PROOF if no timing data is available.
 * 
 * @param traces - Traces to verify
 * @param check - Timing check specification
 * @param options - Verification options
 * @returns Verification result
 * 
 * @example
 * ```typescript
 * const result = verifyWithinFromTraces(
 *   traces,
 *   { thresholdMs: 200, percentile: 50, description: 'p50 latency' },
 *   { handlerName: 'Login', minSamples: 10 }
 * );
 * ```
 */
export function verifyWithinFromTraces(
  traces: Trace[],
  check: TimingCheck,
  options: TraceTimingOptions = {}
): TraceTimingResult {
  const minSamples = options.minSamples ?? DEFAULT_TRACE_TIMING_OPTIONS.minSamples;
  const description = options.description ?? 
    `within ${check.thresholdMs}ms (p${check.percentile})`;
  
  // Extract durations
  const samples = extractHandlerDurations(traces, options);
  
  // Check if we have enough samples
  if (samples.length < minSamples) {
    return {
      success: false,
      verdict: 'INCOMPLETE_PROOF',
      sampleCount: samples.length,
      samples,
      error: `Insufficient samples: ${samples.length} < ${minSamples} required`,
      description,
    };
  }
  
  // Sort for percentile calculation
  const sorted = [...samples].sort((a, b) => a - b);
  const actualValue = calculatePercentile(sorted, check.percentile);
  
  // Calculate full stats
  const timingSamples = samples.map(d => ({ duration: d, success: true }));
  const stats = calculateLatencyStats(timingSamples);
  
  const success = actualValue <= check.thresholdMs;
  
  return {
    success,
    verdict: success ? 'PROVEN' : 'NOT_PROVEN',
    sampleCount: samples.length,
    samples,
    stats,
    description,
    error: success ? undefined : 
      `p${check.percentile} latency ${actualValue.toFixed(2)}ms exceeds threshold ${check.thresholdMs}ms`,
  };
}

/**
 * Verify multiple timing requirements at once
 */
export function verifyMultipleTimings(
  traces: Trace[],
  checks: TimingCheck[],
  options: TraceTimingOptions = {}
): {
  success: boolean;
  results: TraceTimingResult[];
  overallStats?: LatencyStats;
} {
  // Extract samples once
  const samples = extractHandlerDurations(traces, options);
  const sorted = [...samples].sort((a, b) => a - b);
  const timingSamples = samples.map(d => ({ duration: d, success: true }));
  const stats = samples.length > 0 ? calculateLatencyStats(timingSamples) : undefined;
  
  const results = checks.map(check => {
    const description = check.description ?? 
      `within ${check.thresholdMs}ms (p${check.percentile})`;
    
    if (samples.length < (options.minSamples ?? 1)) {
      return {
        success: false,
        verdict: 'INCOMPLETE_PROOF' as const,
        sampleCount: samples.length,
        samples,
        error: `Insufficient samples`,
        description,
      };
    }
    
    const actualValue = calculatePercentile(sorted, check.percentile);
    const success = actualValue <= check.thresholdMs;
    
    return {
      success,
      verdict: (success ? 'PROVEN' : 'NOT_PROVEN') as 'PROVEN' | 'NOT_PROVEN',
      sampleCount: samples.length,
      samples,
      stats,
      description,
      error: success ? undefined :
        `p${check.percentile} latency ${actualValue.toFixed(2)}ms exceeds threshold ${check.thresholdMs}ms`,
    };
  });
  
  return {
    success: results.every(r => r.success),
    results,
    overallStats: stats,
  };
}

// ============================================================================
// EVENTUALLY WITHIN FROM TRACES
// ============================================================================

/**
 * Verify an "eventually within" temporal property from traces
 * 
 * Checks that a specific event type occurs within a time bound relative
 * to the trace start (or a reference event).
 * 
 * @param traces - Traces to verify
 * @param eventKind - Event kind to look for (e.g., 'audit_written')
 * @param withinMs - Maximum time in ms for the event to occur
 * @param options - Additional options
 * @returns Verification result
 * 
 * @example
 * ```typescript
 * // Check audit log is written within 5 seconds
 * const result = verifyEventuallyWithin(
 *   traces,
 *   'audit_written',
 *   5000,
 *   { description: 'audit log updated' }
 * );
 * ```
 */
export function verifyEventuallyWithin(
  traces: Trace[],
  eventKind: string,
  withinMs: number,
  options: { description?: string; referenceEventKind?: string } = {}
): EventuallyWithinResult {
  const description = options.description ?? 
    `eventually within ${withinMs}ms: ${eventKind}`;
  
  if (traces.length === 0) {
    return {
      success: false,
      verdict: 'INCOMPLETE_PROOF',
      description,
      error: 'No traces available for verification',
    };
  }
  
  // Check each trace for the event
  for (const trace of traces) {
    const traceStartMs = new Date(trace.startTime).getTime();
    let referenceMs = 0;
    
    // If reference event specified, find it first
    if (options.referenceEventKind) {
      const refEvent = findEvent(trace.events, options.referenceEventKind);
      if (refEvent && refEvent.timing?.startMs !== undefined) {
        referenceMs = refEvent.timing.startMs;
      }
    }
    
    // Look for the target event
    for (const event of trace.events) {
      if (event.kind !== eventKind) continue;
      
      let eventMs: number;
      if (event.timing?.startMs !== undefined) {
        eventMs = event.timing.startMs;
      } else {
        eventMs = new Date(event.time).getTime() - traceStartMs;
      }
      
      const elapsed = eventMs - referenceMs;
      
      if (elapsed <= withinMs) {
        return {
          success: true,
          verdict: 'PROVEN',
          elapsedMs: elapsed,
          satisfyingEvent: event,
          description,
        };
      }
    }
  }
  
  // Event not found within time bound in any trace
  return {
    success: false,
    verdict: 'NOT_PROVEN',
    description,
    error: `Event '${eventKind}' not found within ${withinMs}ms`,
  };
}

/**
 * Find the first event of a given kind
 */
function findEvent(events: TraceEvent[], kind: string): TraceEvent | undefined {
  for (const event of events) {
    if (event.kind === kind) return event;
    // Check nested events
    if (event.events?.length > 0) {
      const nested = findEvent(event.events, kind);
      if (nested) return nested;
    }
  }
  return undefined;
}

// ============================================================================
// ALWAYS/NEVER VERIFICATION FROM TRACES
// ============================================================================

/**
 * Result of always/never verification from traces
 */
export interface AlwaysNeverResult {
  /** Whether the property holds */
  success: boolean;
  /** Verification verdict */
  verdict: 'PROVEN' | 'NOT_PROVEN' | 'INCOMPLETE_PROOF' | 'UNKNOWN';
  /** Number of snapshots checked */
  snapshotsChecked: number;
  /** Number of traces checked */
  tracesChecked: number;
  /** Index of first violation (if any) */
  violationIndex?: number;
  /** Timestamp of violation in ms */
  violationTimeMs?: number;
  /** The violating event (if any) */
  violatingEvent?: TraceEvent;
  /** Error message */
  error?: string;
  /** Description */
  description: string;
  /** Confidence score 0-100 */
  confidence: number;
}

/**
 * Verify an "always" temporal property from traces
 * 
 * Checks that a condition holds at all states across all traces.
 * For event-based checks, verifies that checks of the given kind always pass.
 * 
 * @param traces - Traces to verify
 * @param eventKind - Event kind to check (for check events, verifies they pass)
 * @param clauseText - Description of the clause
 * @param options - Verification options
 * @returns Verification result
 * 
 * @example
 * ```typescript
 * // Verify that balance is always non-negative
 * const result = verifyAlwaysFromTraces(
 *   traces,
 *   'balance_check',
 *   'balance >= 0'
 * );
 * ```
 */
export function verifyAlwaysFromTraces(
  traces: Trace[],
  eventKind: string | undefined,
  clauseText: string,
  options: TraceTimingOptions = {}
): AlwaysNeverResult {
  const minSamples = options.minSamples ?? 1;
  const description = options.description ?? clauseText;
  
  if (traces.length === 0) {
    return {
      success: false,
      verdict: 'INCOMPLETE_PROOF',
      snapshotsChecked: 0,
      tracesChecked: 0,
      description,
      confidence: 0,
      error: 'No traces available for verification',
    };
  }
  
  let totalSnapshots = 0;
  let violationFound = false;
  let violationInfo: {
    index: number;
    timeMs: number;
    event?: TraceEvent;
    traceIndex: number;
  } | undefined;
  
  // Build temporal traces and evaluate
  for (let traceIdx = 0; traceIdx < traces.length; traceIdx++) {
    const trace = traces[traceIdx]!;
    const temporalTrace = buildTemporalTrace(trace);
    
    // Create predicate based on eventKind
    const predicate: StatePredicate = (state, event) => {
      // If no eventKind specified, check that no errors occurred
      if (!eventKind) {
        // Check that we haven't seen a handler_error
        const eventCounts = state._eventCounts as Record<string, number> | undefined;
        return (eventCounts?.['handler_error'] ?? 0) === 0;
      }
      
      // For check events, verify they pass
      if (event?.kind === 'check' && event.inputs?.expression === eventKind) {
        return Boolean(event.outputs?.passed);
      }
      
      // For invariant events
      if (event?.kind === 'invariant' && event.inputs?.expression === eventKind) {
        return Boolean(event.outputs?.passed);
      }
      
      // If the event is the specified kind, check if it indicates failure
      if (event?.kind === eventKind) {
        // handler_error is always a failure
        if (eventKind === 'handler_error') {
          return false;
        }
        // Check events have a passed field
        if ('passed' in (event.outputs ?? {})) {
          return Boolean(event.outputs?.passed);
        }
      }
      
      // Default: no violation at this state
      return true;
    };
    
    const result = evaluateAlways(temporalTrace, predicate, {
      description,
      minSnapshots: minSamples,
    });
    
    totalSnapshots += result.snapshotsEvaluated;
    
    if (!result.satisfied && result.verdict === 'VIOLATED') {
      violationFound = true;
      violationInfo = {
        index: result.violationIndex ?? 0,
        timeMs: result.witnessTimeMs ?? 0,
        event: result.witnessSnapshot?.causingEvent,
        traceIndex: traceIdx,
      };
      break; // Fail fast on first violation
    }
  }
  
  if (totalSnapshots < minSamples) {
    return {
      success: false,
      verdict: 'INCOMPLETE_PROOF',
      snapshotsChecked: totalSnapshots,
      tracesChecked: traces.length,
      description,
      confidence: Math.min(50, (totalSnapshots / minSamples) * 50),
      error: `Insufficient samples: ${totalSnapshots} < ${minSamples} required`,
    };
  }
  
  if (violationFound && violationInfo) {
    return {
      success: false,
      verdict: 'NOT_PROVEN',
      snapshotsChecked: totalSnapshots,
      tracesChecked: traces.length,
      violationIndex: violationInfo.index,
      violationTimeMs: violationInfo.timeMs,
      violatingEvent: violationInfo.event,
      description,
      confidence: calculateAlwaysNeverConfidence(totalSnapshots),
      error: `'${description}' violated at trace ${violationInfo.traceIndex}, snapshot ${violationInfo.index} (t=${violationInfo.timeMs}ms)`,
    };
  }
  
  return {
    success: true,
    verdict: 'PROVEN',
    snapshotsChecked: totalSnapshots,
    tracesChecked: traces.length,
    description,
    confidence: calculateAlwaysNeverConfidence(totalSnapshots),
  };
}

/**
 * Verify a "never" temporal property from traces
 * 
 * Checks that a condition never holds at any state across all traces.
 * This is equivalent to "always not condition".
 * 
 * @param traces - Traces to verify
 * @param eventKind - Event kind that should never occur
 * @param clauseText - Description of the clause
 * @param options - Verification options
 * @returns Verification result
 * 
 * @example
 * ```typescript
 * // Verify that handler_error never occurs
 * const result = verifyNeverFromTraces(
 *   traces,
 *   'handler_error',
 *   'no errors'
 * );
 * ```
 */
export function verifyNeverFromTraces(
  traces: Trace[],
  eventKind: string | undefined,
  clauseText: string,
  options: TraceTimingOptions = {}
): AlwaysNeverResult {
  const minSamples = options.minSamples ?? 1;
  const description = options.description ?? clauseText;
  
  if (traces.length === 0) {
    return {
      success: false,
      verdict: 'INCOMPLETE_PROOF',
      snapshotsChecked: 0,
      tracesChecked: 0,
      description,
      confidence: 0,
      error: 'No traces available for verification',
    };
  }
  
  if (!eventKind) {
    return {
      success: false,
      verdict: 'UNKNOWN',
      snapshotsChecked: 0,
      tracesChecked: 0,
      description,
      confidence: 0,
      error: 'Event kind is required for never verification',
    };
  }
  
  let totalSnapshots = 0;
  let occurrenceFound = false;
  let occurrenceInfo: {
    index: number;
    timeMs: number;
    event?: TraceEvent;
    traceIndex: number;
  } | undefined;
  
  // Build temporal traces and evaluate
  for (let traceIdx = 0; traceIdx < traces.length; traceIdx++) {
    const trace = traces[traceIdx]!;
    const temporalTrace = buildTemporalTrace(trace);
    
    // Create predicate that checks if the forbidden event occurred
    const forbiddenPredicate: StatePredicate = (_state, event) => {
      return event?.kind === eventKind;
    };
    
    const result = evaluateNever(temporalTrace, forbiddenPredicate, {
      description: `never ${eventKind}`,
      minSnapshots: minSamples,
    });
    
    totalSnapshots += result.snapshotsEvaluated;
    
    if (!result.satisfied && result.verdict === 'VIOLATED') {
      occurrenceFound = true;
      occurrenceInfo = {
        index: result.violationIndex ?? 0,
        timeMs: result.witnessTimeMs ?? 0,
        event: result.witnessSnapshot?.causingEvent,
        traceIndex: traceIdx,
      };
      break; // Fail fast on first occurrence
    }
  }
  
  if (totalSnapshots < minSamples) {
    return {
      success: false,
      verdict: 'INCOMPLETE_PROOF',
      snapshotsChecked: totalSnapshots,
      tracesChecked: traces.length,
      description,
      confidence: Math.min(50, (totalSnapshots / minSamples) * 50),
      error: `Insufficient samples: ${totalSnapshots} < ${minSamples} required`,
    };
  }
  
  if (occurrenceFound && occurrenceInfo) {
    return {
      success: false,
      verdict: 'NOT_PROVEN',
      snapshotsChecked: totalSnapshots,
      tracesChecked: traces.length,
      violationIndex: occurrenceInfo.index,
      violationTimeMs: occurrenceInfo.timeMs,
      violatingEvent: occurrenceInfo.event,
      description,
      confidence: calculateAlwaysNeverConfidence(totalSnapshots),
      error: `'${description}' violated - '${eventKind}' occurred at trace ${occurrenceInfo.traceIndex}, snapshot ${occurrenceInfo.index} (t=${occurrenceInfo.timeMs}ms)`,
    };
  }
  
  return {
    success: true,
    verdict: 'PROVEN',
    snapshotsChecked: totalSnapshots,
    tracesChecked: traces.length,
    description,
    confidence: calculateAlwaysNeverConfidence(totalSnapshots),
  };
}

/**
 * Calculate confidence score for always/never verification
 * Based on number of snapshots checked, with diminishing returns
 */
function calculateAlwaysNeverConfidence(snapshotsChecked: number): number {
  if (snapshotsChecked === 0) return 0;
  // Logarithmic scaling: more samples = higher confidence, but diminishing returns
  // 1 sample = ~50%, 10 samples = ~77%, 100 samples = ~90%, 1000 samples = ~95%
  const base = Math.log10(snapshotsChecked + 1) / Math.log10(1001);
  return Math.round(50 + base * 50);
}

// ============================================================================
// TEMPORAL CLAUSE VERIFICATION
// ============================================================================

/**
 * Verify all temporal clauses for a behavior from collected traces
 * 
 * @param traces - Traces from test executions
 * @param clauses - Temporal clause specifications
 * @returns Array of verification results for each clause
 */
export function verifyTemporalClauses(
  traces: Trace[],
  clauses: Array<{
    id: string;
    type: 'within' | 'eventually_within' | 'always' | 'never';
    text: string;
    thresholdMs?: number;
    percentile?: number;
    eventKind?: string;
  }>,
  options: TraceTimingOptions = {}
): TemporalClauseResult[] {
  const results: TemporalClauseResult[] = [];
  
  for (const clause of clauses) {
    let result: TemporalClauseResult;
    
    switch (clause.type) {
      case 'within': {
        if (clause.thresholdMs === undefined || clause.percentile === undefined) {
          result = {
            clauseId: clause.id,
            type: clause.type,
            clauseText: clause.text,
            verdict: 'UNKNOWN',
            success: false,
            error: 'Missing threshold or percentile',
          };
          break;
        }
        
        const timingResult = verifyWithinFromTraces(
          traces,
          { thresholdMs: clause.thresholdMs, percentile: clause.percentile },
          options
        );
        
        result = {
          clauseId: clause.id,
          type: clause.type,
          clauseText: clause.text,
          verdict: timingResult.verdict,
          success: timingResult.success,
          timing: {
            thresholdMs: clause.thresholdMs,
            percentile: clause.percentile,
            actualMs: timingResult.stats ? 
              calculatePercentile(
                [...timingResult.samples].sort((a, b) => a - b),
                clause.percentile
              ) : undefined,
            sampleCount: timingResult.sampleCount,
          },
          error: timingResult.error,
        };
        break;
      }
      
      case 'eventually_within': {
        if (clause.thresholdMs === undefined || clause.eventKind === undefined) {
          result = {
            clauseId: clause.id,
            type: clause.type,
            clauseText: clause.text,
            verdict: 'UNKNOWN',
            success: false,
            error: 'Missing threshold or event kind',
          };
          break;
        }
        
        const eventResult = verifyEventuallyWithin(
          traces,
          clause.eventKind,
          clause.thresholdMs,
          { description: clause.text }
        );
        
        result = {
          clauseId: clause.id,
          type: clause.type,
          clauseText: clause.text,
          verdict: eventResult.verdict,
          success: eventResult.success,
          timing: {
            thresholdMs: clause.thresholdMs,
            actualMs: eventResult.elapsedMs,
          },
          error: eventResult.error,
        };
        break;
      }
      
      case 'always': {
        const alwaysResult = verifyAlwaysFromTraces(
          traces,
          clause.eventKind,
          clause.text,
          options
        );
        
        result = {
          clauseId: clause.id,
          type: clause.type,
          clauseText: clause.text,
          verdict: alwaysResult.verdict,
          success: alwaysResult.success,
          timing: {
            thresholdMs: clause.thresholdMs,
            sampleCount: alwaysResult.snapshotsChecked,
          },
          error: alwaysResult.error,
        };
        break;
      }
      
      case 'never': {
        const neverResult = verifyNeverFromTraces(
          traces,
          clause.eventKind,
          clause.text,
          options
        );
        
        result = {
          clauseId: clause.id,
          type: clause.type,
          clauseText: clause.text,
          verdict: neverResult.verdict,
          success: neverResult.success,
          timing: {
            thresholdMs: clause.thresholdMs,
            sampleCount: neverResult.snapshotsChecked,
          },
          error: neverResult.error,
        };
        break;
      }
      
      default:
        result = {
          clauseId: clause.id,
          type: clause.type,
          clauseText: clause.text,
          verdict: 'UNKNOWN',
          success: false,
          error: `Unknown clause type: '${clause.type}'`,
        };
    }
    
    results.push(result);
  }
  
  return results;
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format temporal clause results as a table
 */
export function formatTemporalClauseTable(results: TemporalClauseResult[]): string {
  if (results.length === 0) {
    return 'No temporal clauses to verify.';
  }
  
  const lines: string[] = [
    '┌────────────────────────────────────────────────────────────────────────────┐',
    '│                         TEMPORAL VERIFICATION                              │',
    '├──────┬────────────────────────────────────┬───────────┬───────────────────┤',
    '│ STAT │ CLAUSE                             │ VERDICT   │ TIMING            │',
    '├──────┼────────────────────────────────────┼───────────┼───────────────────┤',
  ];
  
  for (const result of results) {
    const status = result.success ? '✓' : result.verdict === 'INCOMPLETE_PROOF' ? '?' : '✗';
    const clauseText = truncate(result.clauseText, 34);
    const verdict = padRight(result.verdict, 9);
    
    let timing = '';
    if (result.timing) {
      if (result.timing.actualMs !== undefined) {
        timing = `${result.timing.actualMs.toFixed(1)}ms`;
        if (result.timing.percentile) {
          timing += ` (p${result.timing.percentile})`;
        }
      } else if (result.timing.sampleCount === 0) {
        timing = 'no samples';
      }
    }
    timing = padRight(truncate(timing, 17), 17);
    
    lines.push(`│  ${status}   │ ${padRight(clauseText, 34)} │ ${verdict} │ ${timing} │`);
  }
  
  lines.push('└──────┴────────────────────────────────────┴───────────┴───────────────────┘');
  
  // Summary
  const proven = results.filter(r => r.verdict === 'PROVEN').length;
  const notProven = results.filter(r => r.verdict === 'NOT_PROVEN').length;
  const incomplete = results.filter(r => r.verdict === 'INCOMPLETE_PROOF').length;
  const unknown = results.filter(r => r.verdict === 'UNKNOWN').length;
  
  lines.push('');
  lines.push(`Summary: ${proven} proven, ${notProven} not proven, ${incomplete} incomplete, ${unknown} unknown`);
  
  return lines.join('\n');
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

function padRight(str: string, len: number): string {
  return str + ' '.repeat(Math.max(0, len - str.length));
}
