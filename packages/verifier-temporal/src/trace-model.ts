/**
 * Temporal Trace Model
 * 
 * Models state transitions over time for temporal logic verification.
 * Supports LTL-style operators: always (G), eventually (F), never (!F), within.
 * 
 * @module @isl-lang/verifier-temporal/trace-model
 */

import type { Trace, TraceEvent, TimingInfo } from '@isl-lang/trace-format';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A single state snapshot at a point in time
 */
export interface StateSnapshot {
  /** Timestamp in milliseconds (relative to trace start) */
  timestampMs: number;
  /** Absolute timestamp */
  absoluteTime: string;
  /** State values at this point */
  state: Record<string, unknown>;
  /** The event that caused this state (if any) */
  causingEvent?: TraceEvent;
  /** Sequence number in the trace */
  sequence: number;
}

/**
 * A temporal trace representing state evolution over time
 */
export interface TemporalTrace {
  /** Trace identifier */
  id: string;
  /** Behavior/domain name */
  domain: string;
  /** Ordered sequence of state snapshots */
  snapshots: StateSnapshot[];
  /** Duration of the trace in milliseconds */
  durationMs: number;
  /** Initial state */
  initialState: Record<string, unknown>;
  /** Final state */
  finalState: Record<string, unknown>;
  /** All events in the trace */
  events: TraceEvent[];
}

/**
 * Predicate function evaluated against a state snapshot
 */
export type StatePredicate = (state: Record<string, unknown>, event?: TraceEvent) => boolean;

/**
 * Result of evaluating a temporal property
 */
export interface TemporalEvaluationResult {
  /** Whether the property holds */
  satisfied: boolean;
  /** Verdict category */
  verdict: 'SATISFIED' | 'VIOLATED' | 'UNKNOWN' | 'VACUOUSLY_TRUE';
  /** Index of first violation (for always/never) */
  violationIndex?: number;
  /** Index where property became satisfied (for eventually) */
  satisfactionIndex?: number;
  /** The violating/satisfying snapshot */
  witnessSnapshot?: StateSnapshot;
  /** Time at which violation/satisfaction occurred */
  witnessTimeMs?: number;
  /** Number of snapshots evaluated */
  snapshotsEvaluated: number;
  /** Confidence score (0-100) based on sample size */
  confidence: number;
  /** Human-readable explanation */
  explanation: string;
}

/**
 * Options for temporal evaluation
 */
export interface TemporalEvaluationOptions {
  /** Minimum snapshots required for valid evaluation */
  minSnapshots?: number;
  /** Description for error messages */
  description?: string;
  /** Time bound in milliseconds (for bounded operators) */
  boundMs?: number;
  /** Start time offset in milliseconds */
  startOffsetMs?: number;
  /** End time offset in milliseconds */
  endOffsetMs?: number;
}

// ============================================================================
// TRACE CONSTRUCTION
// ============================================================================

/**
 * Build a temporal trace from a raw trace
 */
export function buildTemporalTrace(trace: Trace): TemporalTrace {
  const traceStartMs = new Date(trace.startTime).getTime();
  const snapshots: StateSnapshot[] = [];
  let currentState: Record<string, unknown> = { ...(trace.initialState ?? {}) };
  let sequence = 0;

  // Create initial snapshot
  snapshots.push({
    timestampMs: 0,
    absoluteTime: trace.startTime,
    state: { ...currentState },
    sequence: sequence++,
  });

  // Process events to build state snapshots
  for (const event of trace.events) {
    const eventTimeMs = getEventTimeMs(event, traceStartMs);
    
    // Update state based on event type
    currentState = updateState(currentState, event);
    
    snapshots.push({
      timestampMs: eventTimeMs,
      absoluteTime: event.time,
      state: { ...currentState },
      causingEvent: event,
      sequence: sequence++,
    });
  }

  // Calculate duration
  const lastSnapshot = snapshots[snapshots.length - 1];
  const durationMs = lastSnapshot?.timestampMs ?? 0;

  return {
    id: trace.id,
    domain: trace.domain,
    snapshots,
    durationMs,
    initialState: snapshots[0]?.state ?? {},
    finalState: lastSnapshot?.state ?? {},
    events: trace.events,
  };
}

/**
 * Get event timestamp in milliseconds relative to trace start
 */
function getEventTimeMs(event: TraceEvent, traceStartMs: number): number {
  if (event.timing?.startMs !== undefined) {
    return event.timing.startMs;
  }
  return new Date(event.time).getTime() - traceStartMs;
}

/**
 * Update state based on an event
 */
function updateState(state: Record<string, unknown>, event: TraceEvent): Record<string, unknown> {
  const newState = { ...state };
  
  // Track event occurrence
  const eventCounts = (newState._eventCounts as Record<string, number>) ?? {};
  eventCounts[event.kind] = (eventCounts[event.kind] ?? 0) + 1;
  newState._eventCounts = eventCounts;
  
  // Track last event of each kind
  const lastEvents = (newState._lastEvents as Record<string, TraceEvent>) ?? {};
  lastEvents[event.kind] = event;
  newState._lastEvents = lastEvents;
  
  // Handle state_change events
  if (event.kind === 'state_change') {
    const path = event.inputs?.path as string[] | undefined;
    const newValue = event.outputs?.newValue;
    if (path && path.length > 0) {
      setNestedValue(newState, path, newValue);
    }
  }
  
  // Handle check events (record pass/fail)
  if (event.kind === 'check') {
    const checkResults = (newState._checkResults as Array<{ expression: string; passed: boolean }>) ?? [];
    checkResults.push({
      expression: String(event.inputs?.expression ?? ''),
      passed: Boolean(event.outputs?.passed),
    });
    newState._checkResults = checkResults;
  }
  
  // Merge outputs into state for visibility
  if (event.outputs) {
    newState._lastOutputs = event.outputs;
  }
  
  return newState;
}

/**
 * Set a nested value in an object
 */
function setNestedValue(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  const lastKey = path[path.length - 1];
  if (lastKey) {
    current[lastKey] = value;
  }
}

// ============================================================================
// TEMPORAL OPERATORS
// ============================================================================

/**
 * Evaluate "always" (G) - property must hold at all states
 * 
 * G(φ) ≡ φ holds at every state in the trace
 */
export function evaluateAlways(
  trace: TemporalTrace,
  predicate: StatePredicate,
  options: TemporalEvaluationOptions = {}
): TemporalEvaluationResult {
  const description = options.description ?? 'always';
  const minSnapshots = options.minSnapshots ?? 1;
  const startOffsetMs = options.startOffsetMs ?? 0;
  const endOffsetMs = options.endOffsetMs ?? trace.durationMs;
  
  // Filter snapshots within time bounds
  const relevantSnapshots = trace.snapshots.filter(
    s => s.timestampMs >= startOffsetMs && s.timestampMs <= endOffsetMs
  );
  
  if (relevantSnapshots.length < minSnapshots) {
    return {
      satisfied: false,
      verdict: 'UNKNOWN',
      snapshotsEvaluated: relevantSnapshots.length,
      confidence: 0,
      explanation: `Insufficient snapshots: ${relevantSnapshots.length} < ${minSnapshots} required for '${description}'`,
    };
  }
  
  // Check predicate at each snapshot
  for (let i = 0; i < relevantSnapshots.length; i++) {
    const snapshot = relevantSnapshots[i]!;
    try {
      if (!predicate(snapshot.state, snapshot.causingEvent)) {
        return {
          satisfied: false,
          verdict: 'VIOLATED',
          violationIndex: i,
          witnessSnapshot: snapshot,
          witnessTimeMs: snapshot.timestampMs,
          snapshotsEvaluated: i + 1,
          confidence: calculateConfidence(i + 1, relevantSnapshots.length),
          explanation: `'${description}' violated at snapshot ${i} (t=${snapshot.timestampMs}ms)`,
        };
      }
    } catch (error) {
      return {
        satisfied: false,
        verdict: 'VIOLATED',
        violationIndex: i,
        witnessSnapshot: snapshot,
        witnessTimeMs: snapshot.timestampMs,
        snapshotsEvaluated: i + 1,
        confidence: calculateConfidence(i + 1, relevantSnapshots.length),
        explanation: `'${description}' threw error at snapshot ${i}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  
  return {
    satisfied: true,
    verdict: 'SATISFIED',
    snapshotsEvaluated: relevantSnapshots.length,
    confidence: calculateConfidence(relevantSnapshots.length, relevantSnapshots.length),
    explanation: `'${description}' held for all ${relevantSnapshots.length} snapshots`,
  };
}

/**
 * Evaluate "eventually" (F) - property must hold at some state
 * 
 * F(φ) ≡ φ holds at some state in the trace
 */
export function evaluateEventually(
  trace: TemporalTrace,
  predicate: StatePredicate,
  options: TemporalEvaluationOptions = {}
): TemporalEvaluationResult {
  const description = options.description ?? 'eventually';
  const boundMs = options.boundMs ?? trace.durationMs;
  const startOffsetMs = options.startOffsetMs ?? 0;
  
  // Filter snapshots within time bounds
  const relevantSnapshots = trace.snapshots.filter(
    s => s.timestampMs >= startOffsetMs && s.timestampMs <= startOffsetMs + boundMs
  );
  
  if (relevantSnapshots.length === 0) {
    return {
      satisfied: false,
      verdict: 'UNKNOWN',
      snapshotsEvaluated: 0,
      confidence: 0,
      explanation: `No snapshots found within time bound for '${description}'`,
    };
  }
  
  // Check predicate at each snapshot
  for (let i = 0; i < relevantSnapshots.length; i++) {
    const snapshot = relevantSnapshots[i]!;
    try {
      if (predicate(snapshot.state, snapshot.causingEvent)) {
        return {
          satisfied: true,
          verdict: 'SATISFIED',
          satisfactionIndex: i,
          witnessSnapshot: snapshot,
          witnessTimeMs: snapshot.timestampMs,
          snapshotsEvaluated: i + 1,
          confidence: calculateConfidence(i + 1, relevantSnapshots.length),
          explanation: `'${description}' satisfied at snapshot ${i} (t=${snapshot.timestampMs}ms)`,
        };
      }
    } catch {
      // Predicate threw - continue checking
    }
  }
  
  return {
    satisfied: false,
    verdict: 'VIOLATED',
    snapshotsEvaluated: relevantSnapshots.length,
    confidence: calculateConfidence(relevantSnapshots.length, relevantSnapshots.length),
    explanation: `'${description}' never became true within ${boundMs}ms (checked ${relevantSnapshots.length} snapshots)`,
  };
}

/**
 * Evaluate "never" (!F) - property must never hold
 * 
 * !F(φ) ≡ G(!φ) ≡ φ never holds at any state
 */
export function evaluateNever(
  trace: TemporalTrace,
  predicate: StatePredicate,
  options: TemporalEvaluationOptions = {}
): TemporalEvaluationResult {
  const description = options.description ?? 'never';
  
  // "never φ" is equivalent to "always !φ"
  const invertedPredicate: StatePredicate = (state, event) => !predicate(state, event);
  
  const result = evaluateAlways(trace, invertedPredicate, {
    ...options,
    description: `never(${description})`,
  });
  
  // Adjust explanation for "never" semantics
  if (result.verdict === 'VIOLATED') {
    return {
      ...result,
      explanation: `'${description}' occurred at snapshot ${result.violationIndex} (t=${result.witnessTimeMs}ms) - should never happen`,
    };
  }
  
  return {
    ...result,
    explanation: result.satisfied 
      ? `'${description}' never occurred (verified over ${result.snapshotsEvaluated} snapshots)`
      : result.explanation,
  };
}

/**
 * Evaluate "within" - event must occur within time bound
 * 
 * Checks that a specific event kind occurs within the specified duration
 */
export function evaluateWithin(
  trace: TemporalTrace,
  eventKind: string,
  boundMs: number,
  options: TemporalEvaluationOptions = {}
): TemporalEvaluationResult {
  const description = options.description ?? `${eventKind} within ${boundMs}ms`;
  const startOffsetMs = options.startOffsetMs ?? 0;
  
  // Find the first occurrence of the event kind
  for (const snapshot of trace.snapshots) {
    if (snapshot.timestampMs < startOffsetMs) continue;
    if (snapshot.timestampMs > startOffsetMs + boundMs) break;
    
    if (snapshot.causingEvent?.kind === eventKind) {
      return {
        satisfied: true,
        verdict: 'SATISFIED',
        satisfactionIndex: snapshot.sequence,
        witnessSnapshot: snapshot,
        witnessTimeMs: snapshot.timestampMs,
        snapshotsEvaluated: snapshot.sequence + 1,
        confidence: 100,
        explanation: `'${eventKind}' occurred at t=${snapshot.timestampMs}ms (within ${boundMs}ms bound)`,
      };
    }
  }
  
  return {
    satisfied: false,
    verdict: 'VIOLATED',
    snapshotsEvaluated: trace.snapshots.length,
    confidence: 100,
    explanation: `'${eventKind}' did not occur within ${boundMs}ms`,
  };
}

/**
 * Evaluate bounded "always" - property must hold for duration
 * 
 * G[0,t](φ) ≡ φ holds for all states within time [0, t]
 */
export function evaluateAlwaysFor(
  trace: TemporalTrace,
  predicate: StatePredicate,
  durationMs: number,
  options: TemporalEvaluationOptions = {}
): TemporalEvaluationResult {
  return evaluateAlways(trace, predicate, {
    ...options,
    endOffsetMs: durationMs,
    description: options.description ?? `always for ${durationMs}ms`,
  });
}

/**
 * Evaluate bounded "eventually" - property must hold within duration
 * 
 * F[0,t](φ) ≡ φ holds at some state within time [0, t]
 */
export function evaluateEventuallyWithin(
  trace: TemporalTrace,
  predicate: StatePredicate,
  boundMs: number,
  options: TemporalEvaluationOptions = {}
): TemporalEvaluationResult {
  return evaluateEventually(trace, predicate, {
    ...options,
    boundMs,
    description: options.description ?? `eventually within ${boundMs}ms`,
  });
}

// ============================================================================
// COMPOUND OPERATORS
// ============================================================================

/**
 * Evaluate "until" - φ holds until ψ becomes true
 * 
 * φ U ψ ≡ ψ eventually holds, and φ holds until then
 */
export function evaluateUntil(
  trace: TemporalTrace,
  holdPredicate: StatePredicate,
  untilPredicate: StatePredicate,
  options: TemporalEvaluationOptions = {}
): TemporalEvaluationResult {
  const description = options.description ?? 'until';
  const minSnapshots = options.minSnapshots ?? 1;
  
  if (trace.snapshots.length < minSnapshots) {
    return {
      satisfied: false,
      verdict: 'UNKNOWN',
      snapshotsEvaluated: trace.snapshots.length,
      confidence: 0,
      explanation: `Insufficient snapshots for '${description}'`,
    };
  }
  
  for (let i = 0; i < trace.snapshots.length; i++) {
    const snapshot = trace.snapshots[i]!;
    
    // Check if "until" condition is satisfied
    if (untilPredicate(snapshot.state, snapshot.causingEvent)) {
      return {
        satisfied: true,
        verdict: 'SATISFIED',
        satisfactionIndex: i,
        witnessSnapshot: snapshot,
        witnessTimeMs: snapshot.timestampMs,
        snapshotsEvaluated: i + 1,
        confidence: calculateConfidence(i + 1, trace.snapshots.length),
        explanation: `'${description}' satisfied at snapshot ${i}`,
      };
    }
    
    // "Hold" predicate must be true until "until" predicate becomes true
    if (!holdPredicate(snapshot.state, snapshot.causingEvent)) {
      return {
        satisfied: false,
        verdict: 'VIOLATED',
        violationIndex: i,
        witnessSnapshot: snapshot,
        witnessTimeMs: snapshot.timestampMs,
        snapshotsEvaluated: i + 1,
        confidence: calculateConfidence(i + 1, trace.snapshots.length),
        explanation: `'${description}' violated - hold condition failed at snapshot ${i} before until condition was met`,
      };
    }
  }
  
  // "Until" condition never became true
  return {
    satisfied: false,
    verdict: 'VIOLATED',
    snapshotsEvaluated: trace.snapshots.length,
    confidence: calculateConfidence(trace.snapshots.length, trace.snapshots.length),
    explanation: `'${description}' violated - until condition never became true`,
  };
}

/**
 * Evaluate "leads to" (response pattern) - whenever φ, eventually ψ
 * 
 * G(φ → F ψ) ≡ every occurrence of φ is followed by ψ
 */
export function evaluateLeadsTo(
  trace: TemporalTrace,
  triggerPredicate: StatePredicate,
  responsePredicate: StatePredicate,
  options: TemporalEvaluationOptions & { responseWindowMs?: number } = {}
): TemporalEvaluationResult {
  const description = options.description ?? 'leads to';
  const responseWindowMs = options.responseWindowMs ?? trace.durationMs;
  
  let triggersFound = 0;
  let responsesFound = 0;
  
  for (let i = 0; i < trace.snapshots.length; i++) {
    const snapshot = trace.snapshots[i]!;
    
    if (triggerPredicate(snapshot.state, snapshot.causingEvent)) {
      triggersFound++;
      
      // Look for response within window
      let foundResponse = false;
      for (let j = i + 1; j < trace.snapshots.length; j++) {
        const futureSnapshot = trace.snapshots[j]!;
        if (futureSnapshot.timestampMs > snapshot.timestampMs + responseWindowMs) {
          break;
        }
        
        if (responsePredicate(futureSnapshot.state, futureSnapshot.causingEvent)) {
          foundResponse = true;
          responsesFound++;
          break;
        }
      }
      
      if (!foundResponse) {
        return {
          satisfied: false,
          verdict: 'VIOLATED',
          violationIndex: i,
          witnessSnapshot: snapshot,
          witnessTimeMs: snapshot.timestampMs,
          snapshotsEvaluated: trace.snapshots.length,
          confidence: calculateConfidence(trace.snapshots.length, trace.snapshots.length),
          explanation: `'${description}' violated - trigger at snapshot ${i} had no response within ${responseWindowMs}ms`,
        };
      }
    }
  }
  
  if (triggersFound === 0) {
    return {
      satisfied: true,
      verdict: 'VACUOUSLY_TRUE',
      snapshotsEvaluated: trace.snapshots.length,
      confidence: 50, // Lower confidence for vacuous truth
      explanation: `'${description}' vacuously satisfied - no triggers found`,
    };
  }
  
  return {
    satisfied: true,
    verdict: 'SATISFIED',
    snapshotsEvaluated: trace.snapshots.length,
    confidence: calculateConfidence(trace.snapshots.length, trace.snapshots.length),
    explanation: `'${description}' satisfied - all ${triggersFound} triggers had responses`,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate confidence score based on samples evaluated
 */
function calculateConfidence(evaluated: number, total: number): number {
  if (total === 0) return 0;
  // Base confidence on coverage, with diminishing returns after 10 samples
  const coverage = evaluated / total;
  const sampleBonus = Math.min(evaluated / 10, 1) * 0.2;
  return Math.round((coverage * 0.8 + sampleBonus) * 100);
}

/**
 * Create a predicate that checks for event occurrence
 */
export function eventOccurred(eventKind: string): StatePredicate {
  return (_state, event) => event?.kind === eventKind;
}

/**
 * Create a predicate that checks event count
 */
export function eventCountAtLeast(eventKind: string, count: number): StatePredicate {
  return (state) => {
    const counts = state._eventCounts as Record<string, number> | undefined;
    return (counts?.[eventKind] ?? 0) >= count;
  };
}

/**
 * Create a predicate that checks a state value
 */
export function stateEquals(path: string[], value: unknown): StatePredicate {
  return (state) => {
    let current: unknown = state;
    for (const key of path) {
      if (typeof current !== 'object' || current === null) return false;
      current = (current as Record<string, unknown>)[key];
    }
    return current === value;
  };
}

/**
 * Create a predicate that checks if a state value satisfies a condition
 */
export function stateSatisfies(path: string[], condition: (value: unknown) => boolean): StatePredicate {
  return (state) => {
    let current: unknown = state;
    for (const key of path) {
      if (typeof current !== 'object' || current === null) return false;
      current = (current as Record<string, unknown>)[key];
    }
    return condition(current);
  };
}

/**
 * Combine predicates with AND
 */
export function and(...predicates: StatePredicate[]): StatePredicate {
  return (state, event) => predicates.every(p => p(state, event));
}

/**
 * Combine predicates with OR
 */
export function or(...predicates: StatePredicate[]): StatePredicate {
  return (state, event) => predicates.some(p => p(state, event));
}

/**
 * Negate a predicate
 */
export function not(predicate: StatePredicate): StatePredicate {
  return (state, event) => !predicate(state, event);
}
