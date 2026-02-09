/**
 * Sequence-Based Temporal Verifier
 * 
 * Implements temporal checks for event sequences:
 * - "before": event A must happen before event B
 * - "cooldown": event A cannot happen again within duration D
 * - "retry": if event A fails, it must retry within duration D
 * - "time window": event A must happen within time window [start, end]
 * 
 * @module @isl-lang/verifier-temporal/sequence-verifier
 */

import type { Trace, TraceEvent } from '@isl-lang/trace-format';
import type { TemporalTrace } from './trace-model.js';
import { buildTemporalTrace } from './trace-model.js';
import { toMilliseconds } from './timing.js';

/**
 * Duration literal type (compatible with ISL core)
 */
export interface DurationLiteral {
  value: number;
  unit: 'ms' | 's' | 'm' | 'h' | 'd';
}

/**
 * Convert duration unit to timing.ts format
 */
function convertUnit(unit: DurationLiteral['unit']): 'ms' | 'seconds' | 'minutes' | 'hours' | 'days' {
  const unitMap: Record<DurationLiteral['unit'], 'ms' | 'seconds' | 'minutes' | 'hours' | 'days'> = {
    'ms': 'ms',
    's': 'seconds',
    'm': 'minutes',
    'h': 'hours',
    'd': 'days',
  };
  return unitMap[unit];
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Temporal sequence rule types
 */
export type SequenceRuleType = 'before' | 'cooldown' | 'retry' | 'time_window';

/**
 * Base sequence rule
 */
export interface SequenceRule {
  /** Rule type */
  type: SequenceRuleType;
  /** Rule identifier */
  id: string;
  /** Human-readable description */
  description: string;
}

/**
 * "Before" rule: event A must happen before event B
 */
export interface BeforeRule extends SequenceRule {
  type: 'before';
  /** Event that must happen first */
  firstEvent: EventMatcher;
  /** Event that must happen after */
  secondEvent: EventMatcher;
  /** Whether to allow same timestamp (default: false) */
  allowSameTime?: boolean;
}

/**
 * "Cooldown" rule: event A cannot happen again within duration D
 */
export interface CooldownRule extends SequenceRule {
  type: 'cooldown';
  /** Event that has cooldown */
  event: EventMatcher;
  /** Cooldown duration */
  duration: DurationLiteral;
  /** Whether to check globally or per correlation ID */
  perCorrelationId?: boolean;
}

/**
 * "Retry" rule: if event A fails, it must retry within duration D
 */
export interface RetryRule extends SequenceRule {
  type: 'retry';
  /** Event that may fail and retry */
  event: EventMatcher;
  /** Maximum time between failure and retry */
  retryWindow: DurationLiteral;
  /** Maximum number of retries allowed */
  maxRetries?: number;
}

/**
 * "Time window" rule: event A must happen within time window [start, end]
 */
export interface TimeWindowRule extends SequenceRule {
  type: 'time_window';
  /** Event that must occur in window */
  event: EventMatcher;
  /** Window start time (relative to trace start or absolute) */
  windowStart: DurationLiteral | number;
  /** Window end time (relative to trace start or absolute) */
  windowEnd: DurationLiteral | number;
  /** Whether times are relative to trace start (default: true) */
  relativeToTraceStart?: boolean;
}

/**
 * Union type for all sequence rules
 */
export type SequenceRuleUnion = BeforeRule | CooldownRule | RetryRule | TimeWindowRule;

/**
 * Event matcher - specifies which events to match
 */
export interface EventMatcher {
  /** Event kind to match */
  kind?: string;
  /** Handler name pattern */
  handler?: string | RegExp;
  /** Additional predicate function */
  predicate?: (event: TraceEvent) => boolean;
}

/**
 * Sequence verification result
 */
export interface SequenceVerificationResult {
  /** Rule that was verified */
  rule: SequenceRuleUnion;
  /** Whether the rule was satisfied */
  satisfied: boolean;
  /** Verdict category */
  verdict: 'SATISFIED' | 'VIOLATED' | 'UNKNOWN';
  /** Violation details if violated */
  violation?: SequenceViolation;
  /** Evidence from trace */
  evidence: SequenceEvidence;
  /** Human-readable explanation */
  explanation: string;
}

/**
 * Sequence violation details
 */
export interface SequenceViolation {
  /** Type of violation */
  type: 'before_violation' | 'cooldown_violation' | 'retry_violation' | 'time_window_violation';
  /** First violating event */
  violatingEvent: TraceEvent;
  /** Second violating event (for before violations) */
  secondEvent?: TraceEvent;
  /** Timestamp of violation */
  timestampMs: number;
  /** Expected behavior */
  expected: string;
  /** Actual behavior */
  actual: string;
}

/**
 * Evidence collected from trace
 */
export interface SequenceEvidence {
  /** Events matched by the rule */
  matchedEvents: Array<{
    event: TraceEvent;
    timestampMs: number;
    sequence: number;
  }>;
  /** Total events examined */
  totalEvents: number;
  /** Trace duration */
  traceDurationMs: number;
}

// ============================================================================
// VERIFICATION FUNCTIONS
// ============================================================================

/**
 * Verify a sequence rule against a trace
 */
export function verifySequenceRule(
  rule: SequenceRuleUnion,
  trace: Trace
): SequenceVerificationResult {
  const temporalTrace = buildTemporalTrace(trace);
  
  switch (rule.type) {
    case 'before':
      return verifyBeforeRule(rule, temporalTrace);
    case 'cooldown':
      return verifyCooldownRule(rule, temporalTrace);
    case 'retry':
      return verifyRetryRule(rule, temporalTrace);
    case 'time_window':
      return verifyTimeWindowRule(rule, temporalTrace);
    default:
      return {
        rule,
        satisfied: false,
        verdict: 'UNKNOWN',
        evidence: {
          matchedEvents: [],
          totalEvents: temporalTrace.events.length,
          traceDurationMs: temporalTrace.durationMs,
        },
        explanation: `Unknown sequence rule type: ${(rule as SequenceRule).type}`,
      };
  }
}

/**
 * Verify multiple sequence rules against traces
 */
export function verifySequenceRules(
  rules: SequenceRuleUnion[],
  traces: Trace[]
): SequenceVerificationResult[] {
  const results: SequenceVerificationResult[] = [];
  
  for (const rule of rules) {
    // Check rule against all traces
    const traceResults = traces.map(trace => verifySequenceRule(rule, trace));
    
    // Aggregate results: satisfied if all traces satisfy
    const allSatisfied = traceResults.every(r => r.satisfied);
    const anyViolated = traceResults.some(r => r.verdict === 'VIOLATED');
    
    // Combine evidence
    const combinedEvidence: SequenceEvidence = {
      matchedEvents: traceResults.flatMap(r => r.evidence.matchedEvents),
      totalEvents: traceResults.reduce((sum, r) => sum + r.evidence.totalEvents, 0),
      traceDurationMs: Math.max(...traceResults.map(r => r.evidence.traceDurationMs)),
    };
    
    // Find first violation if any
    const firstViolation = traceResults.find(r => r.violation)?.violation;
    
    const result: SequenceVerificationResult = {
      rule,
      satisfied: allSatisfied,
      verdict: anyViolated ? 'VIOLATED' : (allSatisfied ? 'SATISFIED' : 'UNKNOWN'),
      violation: firstViolation,
      evidence: combinedEvidence,
      explanation: allSatisfied
        ? `Rule satisfied across ${traces.length} trace(s)`
        : firstViolation
        ? `Rule violated: ${firstViolation.expected} but ${firstViolation.actual}`
        : `Rule status unknown across ${traces.length} trace(s)`,
    };
    
    results.push(result);
  }
  
  return results;
}

// ============================================================================
// INDIVIDUAL RULE VERIFIERS
// ============================================================================

/**
 * Verify "before" rule: event A must happen before event B
 */
function verifyBeforeRule(
  rule: BeforeRule,
  trace: TemporalTrace
): SequenceVerificationResult {
  const firstEvents: Array<{ event: TraceEvent; timestampMs: number; sequence: number }> = [];
  const secondEvents: Array<{ event: TraceEvent; timestampMs: number; sequence: number }> = [];
  
  // Collect matching events
  for (let i = 0; i < trace.snapshots.length; i++) {
    const snapshot = trace.snapshots[i]!;
    const event = snapshot.causingEvent;
    
    if (!event) continue;
    
    if (matchesEvent(rule.firstEvent, event)) {
      firstEvents.push({
        event,
        timestampMs: snapshot.timestampMs,
        sequence: snapshot.sequence,
      });
    }
    
    if (matchesEvent(rule.secondEvent, event)) {
      secondEvents.push({
        event,
        timestampMs: snapshot.timestampMs,
        sequence: snapshot.sequence,
      });
    }
  }
  
  // Check violations: second event occurs before first event
  for (const second of secondEvents) {
    // Find if any first event occurs after this second event
    const violatingFirst = firstEvents.find(
      first => rule.allowSameTime
        ? first.sequence > second.sequence
        : first.sequence >= second.sequence
    );
    
    if (violatingFirst) {
      return {
        rule,
        satisfied: false,
        verdict: 'VIOLATED',
        violation: {
          type: 'before_violation',
          violatingEvent: second.event,
          secondEvent: violatingFirst.event,
          timestampMs: second.timestampMs,
          expected: `${formatEventMatcher(rule.firstEvent)} must occur before ${formatEventMatcher(rule.secondEvent)}`,
          actual: `${formatEventMatcher(rule.secondEvent)} occurred at t=${second.timestampMs}ms before ${formatEventMatcher(rule.firstEvent)} at t=${violatingFirst.timestampMs}ms`,
        },
        evidence: {
          matchedEvents: [...firstEvents, ...secondEvents],
          totalEvents: trace.events.length,
          traceDurationMs: trace.durationMs,
        },
        explanation: `Violation: ${formatEventMatcher(rule.secondEvent)} occurred before ${formatEventMatcher(rule.firstEvent)}`,
      };
    }
  }
  
  // Check if first event exists but second doesn't (potential issue)
  if (firstEvents.length > 0 && secondEvents.length === 0) {
    return {
      rule,
      satisfied: true, // Technically satisfied, but incomplete
      verdict: 'SATISFIED',
      evidence: {
        matchedEvents: firstEvents,
        totalEvents: trace.events.length,
        traceDurationMs: trace.durationMs,
      },
      explanation: `${formatEventMatcher(rule.firstEvent)} occurred ${firstEvents.length} time(s), but ${formatEventMatcher(rule.secondEvent)} never occurred`,
    };
  }
  
  return {
    rule,
    satisfied: true,
    verdict: 'SATISFIED',
    evidence: {
      matchedEvents: [...firstEvents, ...secondEvents],
      totalEvents: trace.events.length,
      traceDurationMs: trace.durationMs,
    },
    explanation: `Rule satisfied: ${firstEvents.length} occurrence(s) of ${formatEventMatcher(rule.firstEvent)} before ${secondEvents.length} occurrence(s) of ${formatEventMatcher(rule.secondEvent)}`,
  };
}

/**
 * Verify "cooldown" rule: event A cannot happen again within duration D
 */
function verifyCooldownRule(
  rule: CooldownRule,
  trace: TemporalTrace
): SequenceVerificationResult {
  const unitMap: Record<string, 'ms' | 'seconds' | 'minutes' | 'hours' | 'days'> = {
    'ms': 'ms',
    's': 'seconds',
    'm': 'minutes',
    'h': 'hours',
    'd': 'days',
  };
  const cooldownMs = toMilliseconds(rule.duration.value, unitMap[rule.duration.unit] || 'ms');
  const matchedEvents: Array<{ event: TraceEvent; timestampMs: number; sequence: number; correlationId?: string }> = [];
  
  // Collect matching events
  for (let i = 0; i < trace.snapshots.length; i++) {
    const snapshot = trace.snapshots[i]!;
    const event = snapshot.causingEvent;
    
    if (!event) continue;
    
    if (matchesEvent(rule.event, event)) {
      matchedEvents.push({
        event,
        timestampMs: snapshot.timestampMs,
        sequence: snapshot.sequence,
        correlationId: event.correlationId,
      });
    }
  }
  
  // Check for cooldown violations
  if (rule.perCorrelationId) {
    // Group by correlation ID
    const byCorrelationId = new Map<string, typeof matchedEvents>();
    for (const matched of matchedEvents) {
      const cid = matched.correlationId || 'default';
      if (!byCorrelationId.has(cid)) {
        byCorrelationId.set(cid, []);
      }
      byCorrelationId.get(cid)!.push(matched);
    }
    
    // Check each correlation ID separately
    for (const [cid, events] of byCorrelationId) {
      for (let i = 0; i < events.length - 1; i++) {
        const current = events[i]!;
        const next = events[i + 1]!;
        const timeBetween = next.timestampMs - current.timestampMs;
        
        if (timeBetween < cooldownMs) {
          return {
            rule,
            satisfied: false,
            verdict: 'VIOLATED',
            violation: {
              type: 'cooldown_violation',
              violatingEvent: next.event,
              timestampMs: next.timestampMs,
              expected: `At least ${cooldownMs}ms between occurrences (cooldown: ${formatDuration(rule.duration)})`,
              actual: `Only ${timeBetween}ms between occurrences at t=${current.timestampMs}ms and t=${next.timestampMs}ms`,
            },
            evidence: {
              matchedEvents: matchedEvents.map(e => ({
                event: e.event,
                timestampMs: e.timestampMs,
                sequence: e.sequence,
              })),
              totalEvents: trace.events.length,
              traceDurationMs: trace.durationMs,
            },
            explanation: `Cooldown violation: ${formatEventMatcher(rule.event)} occurred within ${timeBetween}ms (required: ${cooldownMs}ms) for correlation ID ${cid}`,
          };
        }
      }
    }
  } else {
    // Check globally
    for (let i = 0; i < matchedEvents.length - 1; i++) {
      const current = matchedEvents[i]!;
      const next = matchedEvents[i + 1]!;
      const timeBetween = next.timestampMs - current.timestampMs;
      
      if (timeBetween < cooldownMs) {
        return {
          rule,
          satisfied: false,
          verdict: 'VIOLATED',
          violation: {
            type: 'cooldown_violation',
            violatingEvent: next.event,
            timestampMs: next.timestampMs,
            expected: `At least ${cooldownMs}ms between occurrences (cooldown: ${formatDuration(rule.duration)})`,
            actual: `Only ${timeBetween}ms between occurrences at t=${current.timestampMs}ms and t=${next.timestampMs}ms`,
          },
          evidence: {
            matchedEvents: matchedEvents.map(e => ({
              event: e.event,
              timestampMs: e.timestampMs,
              sequence: e.sequence,
            })),
            totalEvents: trace.events.length,
            traceDurationMs: trace.durationMs,
          },
          explanation: `Cooldown violation: ${formatEventMatcher(rule.event)} occurred within ${timeBetween}ms (required: ${cooldownMs}ms)`,
        };
      }
    }
  }
  
  return {
    rule,
    satisfied: true,
    verdict: 'SATISFIED',
    evidence: {
      matchedEvents: matchedEvents.map(e => ({
        event: e.event,
        timestampMs: e.timestampMs,
        sequence: e.sequence,
      })),
      totalEvents: trace.events.length,
      traceDurationMs: trace.durationMs,
    },
    explanation: `Cooldown rule satisfied: ${matchedEvents.length} occurrence(s) of ${formatEventMatcher(rule.event)}, all spaced at least ${cooldownMs}ms apart`,
  };
}

/**
 * Verify "retry" rule: if event A fails, it must retry within duration D
 */
function verifyRetryRule(
  rule: RetryRule,
  trace: TemporalTrace
): SequenceVerificationResult {
  const retryWindowMs = toMilliseconds(rule.retryWindow.value, convertUnit(rule.retryWindow.unit));
  const matchedEvents: Array<{ event: TraceEvent; timestampMs: number; sequence: number; isError: boolean }> = [];
  
  // Collect matching events, marking errors
  for (let i = 0; i < trace.snapshots.length; i++) {
    const snapshot = trace.snapshots[i]!;
    const event = snapshot.causingEvent;
    
    if (!event) continue;
    
    if (matchesEvent(rule.event, event)) {
      const isError = event.kind === 'handler_error' || 
                     (event.outputs && 'error' in event.outputs) ||
                     (event.outputs && 'failed' in event.outputs && event.outputs.failed === true);
      
      matchedEvents.push({
        event,
        timestampMs: snapshot.timestampMs,
        sequence: snapshot.sequence,
        isError,
      });
    }
  }
  
  // Check for retry violations: error without retry within window
  for (let i = 0; i < matchedEvents.length; i++) {
    const current = matchedEvents[i]!;
    
    if (current.isError) {
      // Look for retry within window
      let retryFound = false;
      for (let j = i + 1; j < matchedEvents.length; j++) {
        const next = matchedEvents[j]!;
        const timeBetween = next.timestampMs - current.timestampMs;
        
        if (timeBetween <= retryWindowMs && !next.isError) {
          retryFound = true;
          break;
        }
        
        if (timeBetween > retryWindowMs) {
          break; // Beyond retry window
        }
      }
      
      if (!retryFound) {
        // Check retry count if maxRetries specified
        let retryCount = 0;
        for (let j = i + 1; j < matchedEvents.length; j++) {
          const next = matchedEvents[j]!;
          const timeBetween = next.timestampMs - current.timestampMs;
          if (timeBetween <= retryWindowMs) {
            if (!next.isError) retryCount++;
          } else {
            break;
          }
        }
        
        if (rule.maxRetries && retryCount > rule.maxRetries) {
          return {
            rule,
            satisfied: false,
            verdict: 'VIOLATED',
            violation: {
              type: 'retry_violation',
              violatingEvent: current.event,
              timestampMs: current.timestampMs,
              expected: `At most ${rule.maxRetries} retry(ies) within ${retryWindowMs}ms`,
              actual: `${retryCount} retry(ies) occurred within ${retryWindowMs}ms`,
            },
            evidence: {
              matchedEvents: matchedEvents.map(e => ({
                event: e.event,
                timestampMs: e.timestampMs,
                sequence: e.sequence,
              })),
              totalEvents: trace.events.length,
              traceDurationMs: trace.durationMs,
            },
            explanation: `Retry limit violation: ${retryCount} retry(ies) exceeded max of ${rule.maxRetries}`,
          };
        }
        
        if (!retryFound) {
          return {
            rule,
            satisfied: false,
            verdict: 'VIOLATED',
            violation: {
              type: 'retry_violation',
              violatingEvent: current.event,
              timestampMs: current.timestampMs,
              expected: `Retry within ${retryWindowMs}ms after failure`,
              actual: `No successful retry found within ${retryWindowMs}ms after failure at t=${current.timestampMs}ms`,
            },
            evidence: {
              matchedEvents: matchedEvents.map(e => ({
                event: e.event,
                timestampMs: e.timestampMs,
                sequence: e.sequence,
              })),
              totalEvents: trace.events.length,
              traceDurationMs: trace.durationMs,
            },
            explanation: `Retry violation: ${formatEventMatcher(rule.event)} failed at t=${current.timestampMs}ms but no retry occurred within ${retryWindowMs}ms`,
          };
        }
      }
    }
  }
  
  return {
    rule,
    satisfied: true,
    verdict: 'SATISFIED',
    evidence: {
      matchedEvents: matchedEvents.map(e => ({
        event: e.event,
        timestampMs: e.timestampMs,
        sequence: e.sequence,
      })),
      totalEvents: trace.events.length,
      traceDurationMs: trace.durationMs,
    },
    explanation: `Retry rule satisfied: all failures of ${formatEventMatcher(rule.event)} were retried within ${retryWindowMs}ms`,
  };
}

/**
 * Verify "time window" rule: event A must happen within time window [start, end]
 */
function verifyTimeWindowRule(
  rule: TimeWindowRule,
  trace: TemporalTrace
): SequenceVerificationResult {
  const startMs = typeof rule.windowStart === 'number'
    ? rule.windowStart
    : toMilliseconds(rule.windowStart.value, convertUnit(rule.windowStart.unit));
  const endMs = typeof rule.windowEnd === 'number'
    ? rule.windowEnd
    : toMilliseconds(rule.windowEnd.value, convertUnit(rule.windowEnd.unit));
  
  // For relative times, use 0 as base. For absolute times, we'd need the trace startTime
  // Since TemporalTrace doesn't expose startTime, we assume relative timing
  const absoluteStartMs = rule.relativeToTraceStart !== false ? startMs : startMs;
  const absoluteEndMs = rule.relativeToTraceStart !== false ? endMs : endMs;
  
  const matchedEvents: Array<{ event: TraceEvent; timestampMs: number; sequence: number }> = [];
  
  // Collect matching events
  for (let i = 0; i < trace.snapshots.length; i++) {
    const snapshot = trace.snapshots[i]!;
    const event = snapshot.causingEvent;
    
    if (!event) continue;
    
    if (matchesEvent(rule.event, event)) {
      // For relative times, use snapshot timestamp. For absolute times, use event time
      const eventTimeMs = rule.relativeToTraceStart !== false
        ? snapshot.timestampMs
        : snapshot.timestampMs; // Use relative timestamp for now
      
      matchedEvents.push({
        event,
        timestampMs: eventTimeMs,
        sequence: snapshot.sequence,
      });
    }
  }
  
  // Check for violations: events outside window
  const violations: Array<{ event: TraceEvent; timestampMs: number; reason: string }> = [];
  
  for (const matched of matchedEvents) {
    const eventTimeMs = rule.relativeToTraceStart !== false
      ? matched.timestampMs
      : matched.timestampMs; // For now, assume relative
    
    if (eventTimeMs < absoluteStartMs) {
      violations.push({
        event: matched.event,
        timestampMs: eventTimeMs,
        reason: `Event occurred at t=${eventTimeMs}ms, before window start at t=${absoluteStartMs}ms`,
      });
    } else if (eventTimeMs > absoluteEndMs) {
      violations.push({
        event: matched.event,
        timestampMs: eventTimeMs,
        reason: `Event occurred at t=${eventTimeMs}ms, after window end at t=${absoluteEndMs}ms`,
      });
    }
  }
  
  if (violations.length > 0) {
    const firstViolation = violations[0]!;
    return {
      rule,
      satisfied: false,
      verdict: 'VIOLATED',
      violation: {
        type: 'time_window_violation',
        violatingEvent: firstViolation.event,
        timestampMs: firstViolation.timestampMs,
        expected: `Event must occur within window [${absoluteStartMs}ms, ${absoluteEndMs}ms]`,
        actual: firstViolation.reason,
      },
      evidence: {
        matchedEvents: matchedEvents.map(e => ({
          event: e.event,
          timestampMs: e.timestampMs,
          sequence: e.sequence,
        })),
        totalEvents: trace.events.length,
        traceDurationMs: trace.durationMs,
      },
      explanation: `Time window violation: ${violations.length} occurrence(s) of ${formatEventMatcher(rule.event)} outside window [${absoluteStartMs}ms, ${absoluteEndMs}ms]`,
    };
  }
  
  if (matchedEvents.length === 0) {
    return {
      rule,
      satisfied: false,
      verdict: 'UNKNOWN',
      evidence: {
        matchedEvents: [],
        totalEvents: trace.events.length,
        traceDurationMs: trace.durationMs,
      },
      explanation: `Time window rule: ${formatEventMatcher(rule.event)} never occurred in trace`,
    };
  }
  
  return {
    rule,
    satisfied: true,
    verdict: 'SATISFIED',
    evidence: {
      matchedEvents: matchedEvents.map(e => ({
        event: e.event,
        timestampMs: e.timestampMs,
        sequence: e.sequence,
      })),
      totalEvents: trace.events.length,
      traceDurationMs: trace.durationMs,
    },
    explanation: `Time window rule satisfied: ${matchedEvents.length} occurrence(s) of ${formatEventMatcher(rule.event)} within window [${absoluteStartMs}ms, ${absoluteEndMs}ms]`,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if an event matches the matcher
 */
function matchesEvent(matcher: EventMatcher, event: TraceEvent): boolean {
  if (matcher.kind && event.kind !== matcher.kind) {
    return false;
  }
  
  if (matcher.handler) {
    if (typeof matcher.handler === 'string') {
      if (event.handler !== matcher.handler) {
        return false;
      }
    } else {
      // RegExp
      if (!matcher.handler.test(event.handler)) {
        return false;
      }
    }
  }
  
  if (matcher.predicate && !matcher.predicate(event)) {
    return false;
  }
  
  return true;
}

/**
 * Format an event matcher as a string
 */
function formatEventMatcher(matcher: EventMatcher): string {
  const parts: string[] = [];
  
  if (matcher.kind) {
    parts.push(`kind=${matcher.kind}`);
  }
  
  if (matcher.handler) {
    if (typeof matcher.handler === 'string') {
      parts.push(`handler=${matcher.handler}`);
    } else {
      parts.push(`handler=${matcher.handler.source}`);
    }
  }
  
  return parts.length > 0 ? parts.join(', ') : 'any event';
}

/**
 * Format a duration literal
 */
function formatDuration(duration: DurationLiteral): string {
  return `${duration.value}${duration.unit}`;
}
