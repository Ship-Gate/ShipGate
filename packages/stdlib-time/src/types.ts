// ============================================================================
// ISL Time Contracts - Type Definitions
// ============================================================================

/**
 * Time unit
 */
export type TimeUnit =
  | 'nanoseconds'
  | 'microseconds'
  | 'milliseconds'
  | 'seconds'
  | 'minutes'
  | 'hours'
  | 'days';

/**
 * Duration - represents a time span
 */
export interface Duration {
  value: number;
  unit: TimeUnit;
}

/**
 * Timestamp - absolute point in time
 */
export interface Timestamp {
  epochNanos: bigint;
}

/**
 * Time interval
 */
export interface TimeInterval {
  start: Timestamp;
  end: Timestamp;
}

/**
 * Clock type
 */
export type ClockType =
  | 'system'
  | 'monotonic'
  | 'process_cpu'
  | 'thread_cpu'
  | 'high_resolution';

/**
 * Deadline type
 */
export type DeadlineType = 'hard' | 'firm' | 'soft' | 'best_effort';

/**
 * Deadline penalty
 */
export type DeadlinePenalty =
  | { kind: 'Abort' }
  | { kind: 'Timeout'; duration: Duration }
  | { kind: 'Escalate'; to: string }
  | { kind: 'Compensate'; action: string };

/**
 * Deadline
 */
export interface Deadline {
  timestamp: Timestamp;
  type: DeadlineType;
  penalty?: DeadlinePenalty;
}

/**
 * Deadline constraint kind
 */
export type DeadlineConstraintKind =
  | 'response_time'
  | 'execution_time'
  | 'blocking_time'
  | 'jitter';

/**
 * Deadline constraint
 */
export interface DeadlineConstraint {
  kind: DeadlineConstraintKind;
  duration: Duration;
  type: DeadlineType;
}

/**
 * Real-time behavior state
 */
export type RealtimeBehaviorState =
  | 'pending'
  | 'running'
  | 'blocked'
  | 'completed'
  | 'missed';

/**
 * Real-time behavior specification
 */
export interface RealtimeBehavior {
  name: string;
  wcet: Duration;
  deadline: Duration;
  period?: Duration;
  priority: number;
  state?: RealtimeBehaviorState;
}

/**
 * Execution result
 */
export interface ExecutionResult<T> {
  result: T;
  startTime: Timestamp;
  endTime: Timestamp;
  actualDuration: Duration;
  deadlineSlack: Duration;
}

/**
 * Scheduled task status
 */
export type ScheduleStatus = 'active' | 'paused' | 'completed' | 'cancelled';

/**
 * Scheduled task
 */
export interface ScheduledTask {
  id: string;
  task: RealtimeBehavior;
  nextExecution: Timestamp;
  executionCount: number;
  missedCount: number;
  status: ScheduleStatus;
}

/**
 * Scheduling policy
 */
export type SchedulingPolicy =
  | 'rate_monotonic'
  | 'deadline_monotonic'
  | 'earliest_deadline_first'
  | 'least_laxity_first'
  | 'round_robin'
  | 'priority_based';

/**
 * Scheduler
 */
export interface Scheduler {
  id: string;
  policy: SchedulingPolicy;
  tasks: ScheduledTask[];
  currentTask?: ScheduledTask;
  utilization: number;
}

/**
 * Schedulability result
 */
export interface SchedulabilityResult {
  schedulable: boolean;
  utilization: number;
  responseTimes: Map<string, Duration>;
  bottleneck?: string;
  suggestions: string[];
}

/**
 * LTL Formula
 */
export type LTLFormula =
  | { kind: 'Prop'; name: string }
  | { kind: 'True' }
  | { kind: 'False' }
  | { kind: 'Not'; inner: LTLFormula }
  | { kind: 'And'; left: LTLFormula; right: LTLFormula }
  | { kind: 'Or'; left: LTLFormula; right: LTLFormula }
  | { kind: 'Implies'; left: LTLFormula; right: LTLFormula }
  | { kind: 'Next'; inner: LTLFormula }
  | { kind: 'Always'; inner: LTLFormula }
  | { kind: 'Eventually'; inner: LTLFormula }
  | { kind: 'Until'; left: LTLFormula; right: LTLFormula }
  | { kind: 'WeakUntil'; left: LTLFormula; right: LTLFormula }
  | { kind: 'Release'; left: LTLFormula; right: LTLFormula };

/**
 * MTL Formula (Metric Temporal Logic)
 */
export type MTLFormula =
  | { kind: 'Prop'; name: string }
  | { kind: 'Not'; inner: MTLFormula }
  | { kind: 'And'; left: MTLFormula; right: MTLFormula }
  | { kind: 'Or'; left: MTLFormula; right: MTLFormula }
  | { kind: 'AlwaysWithin'; inner: MTLFormula; interval: TimeInterval }
  | { kind: 'EventuallyWithin'; inner: MTLFormula; interval: TimeInterval }
  | { kind: 'UntilWithin'; left: MTLFormula; right: MTLFormula; interval: TimeInterval }
  | { kind: 'WithinDuration'; inner: MTLFormula; duration: Duration }
  | { kind: 'AtTime'; inner: MTLFormula; time: Timestamp };

/**
 * Trace state
 */
export interface TraceState {
  time: Timestamp;
  propositions: Map<string, boolean>;
  variables: Map<string, unknown>;
}

/**
 * Execution trace
 */
export interface Trace {
  states: TraceState[];
  duration: Duration;
}

/**
 * Temporal verification result
 */
export interface TemporalVerificationResult {
  satisfied: boolean;
  counterexample?: Trace;
  statistics: VerificationStats;
}

/**
 * Verification statistics
 */
export interface VerificationStats {
  statesExplored: number;
  transitionsExplored: number;
  time: Duration;
  memory: number;
}

/**
 * Rate limiter
 */
export interface RateLimiter {
  id: string;
  maxRequests: number;
  window: Duration;
  currentCount: number;
  windowStart: Timestamp;
}

/**
 * Timeout error
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly deadline: Deadline,
    public readonly elapsed: Duration
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Deadline missed error
 */
export class DeadlineMissedError extends Error {
  constructor(
    message: string,
    public readonly deadline: Deadline,
    public readonly actual: Timestamp
  ) {
    super(message);
    this.name = 'DeadlineMissedError';
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitExceededError extends Error {
  constructor(
    message: string,
    public readonly limiter: RateLimiter
  ) {
    super(message);
    this.name = 'RateLimitExceededError';
  }
}
