// ============================================================================
// ISL Time Contracts - Standard Library
// Real-time constraints, deadlines, scheduling, and temporal logic
// ============================================================================

domain TimeContracts
version "0.1.0"
owner "IntentOS"

// ============================================================================
// TIME TYPES
// ============================================================================

type Duration = {
  value: Int { min: 0 }
  unit: TimeUnit
}

type TimeUnit = enum {
  NANOSECONDS
  MICROSECONDS
  MILLISECONDS
  SECONDS
  MINUTES
  HOURS
  DAYS
}

type Timestamp = {
  epochNanos: Int { min: 0 }
}

type TimeInterval = {
  start: Timestamp
  end: Timestamp
  
  invariant start.epochNanos <= end.epochNanos
}

type Clock = enum {
  SYSTEM
  MONOTONIC
  PROCESS_CPU
  THREAD_CPU
  HIGH_RESOLUTION
}

// ============================================================================
// DEADLINE CONTRACTS
// ============================================================================

type Deadline = {
  timestamp: Timestamp
  type: DeadlineType
  penalty: Optional<DeadlinePenalty>
}

type DeadlineType = enum {
  HARD
  FIRM
  SOFT
  BEST_EFFORT
}

type DeadlinePenalty = union {
  | Abort
  | Timeout { duration: Duration }
  | Escalate { to: String }
  | Compensate { action: String }
}

type DeadlineConstraint = {
  kind: DeadlineConstraintKind
  duration: Duration
  type: DeadlineType
}

type DeadlineConstraintKind = enum {
  RESPONSE_TIME
  EXECUTION_TIME
  BLOCKING_TIME
  JITTER
}

// ============================================================================
// REAL-TIME BEHAVIORS
// ============================================================================

entity RealtimeBehavior {
  name: String
  wcet: Duration
  deadline: Duration
  period: Optional<Duration>
  priority: Int { min: 0, max: 255 }
  
  lifecycle {
    states: [PENDING, RUNNING, BLOCKED, COMPLETED, MISSED]
    transitions {
      PENDING -> RUNNING via Dispatch
      RUNNING -> BLOCKED via Block
      BLOCKED -> RUNNING via Unblock
      RUNNING -> COMPLETED via Complete
      RUNNING -> MISSED via DeadlineMiss
      BLOCKED -> MISSED via DeadlineMiss
    }
  }
}

behavior ExecuteWithDeadline<T> {
  description: "Execute an operation with a deadline"
  
  input {
    operation: () -> T
    deadline: Deadline
    fallback: Optional<() -> T>
  }
  
  output {
    success: ExecutionResult<T>
    errors {
      DeadlineMissed when "Operation did not complete before deadline"
      Aborted when "Operation was aborted"
    }
  }
}

type ExecutionResult<T> = {
  result: T
  startTime: Timestamp
  endTime: Timestamp
  actualDuration: Duration
  deadlineSlack: Duration
}

behavior SchedulePeriodic {
  description: "Schedule a periodic task"
  
  input {
    task: RealtimeBehavior
    startTime: Optional<Timestamp>
    count: Optional<Int>
  }
  
  output {
    success: ScheduledTask
    errors {
      UnschedulableTask when "Cannot guarantee deadline"
      ResourceUnavailable when "Insufficient resources"
    }
  }
}

type ScheduledTask = {
  id: UUID
  task: RealtimeBehavior
  nextExecution: Timestamp
  executionCount: Int
  missedCount: Int
  status: ScheduleStatus
}

type ScheduleStatus = enum {
  ACTIVE
  PAUSED
  COMPLETED
  CANCELLED
}

// ============================================================================
// TEMPORAL LOGIC
// ============================================================================

type LTLFormula = union {
  | Prop { name: String }
  | True
  | False
  | Not { inner: LTLFormula }
  | And { left: LTLFormula, right: LTLFormula }
  | Or { left: LTLFormula, right: LTLFormula }
  | Implies { left: LTLFormula, right: LTLFormula }
  | Next { inner: LTLFormula }
  | Always { inner: LTLFormula }
  | Eventually { inner: LTLFormula }
  | Until { left: LTLFormula, right: LTLFormula }
  | WeakUntil { left: LTLFormula, right: LTLFormula }
  | Release { left: LTLFormula, right: LTLFormula }
}

type MTLFormula = union {
  | Prop { name: String }
  | Not { inner: MTLFormula }
  | And { left: MTLFormula, right: MTLFormula }
  | Or { left: MTLFormula, right: MTLFormula }
  | AlwaysWithin { inner: MTLFormula, interval: TimeInterval }
  | EventuallyWithin { inner: MTLFormula, interval: TimeInterval }
  | UntilWithin { left: MTLFormula, right: MTLFormula, interval: TimeInterval }
  | WithinDuration { inner: MTLFormula, duration: Duration }
  | AtTime { inner: MTLFormula, time: Timestamp }
}

// ============================================================================
// SCHEDULING
// ============================================================================

type SchedulingPolicy = enum {
  RATE_MONOTONIC
  DEADLINE_MONOTONIC
  EARLIEST_DEADLINE_FIRST
  LEAST_LAXITY_FIRST
  ROUND_ROBIN
  PRIORITY_BASED
}

entity Scheduler {
  id: UUID
  policy: SchedulingPolicy
  tasks: List<ScheduledTask>
  currentTask: Optional<ScheduledTask>
  utilization: Decimal { min: 0, max: 1 }
  
  invariant utilization <= 1.0
}

behavior AnalyzeSchedulability {
  description: "Analyze if a task set is schedulable"
  
  input {
    tasks: List<RealtimeBehavior>
    policy: SchedulingPolicy
  }
  
  output {
    success: SchedulabilityResult
  }
}

type SchedulabilityResult = {
  schedulable: Boolean
  utilization: Decimal
  responseTimes: Map<String, Duration>
  bottleneck: Optional<String>
  suggestions: List<String>
}

// ============================================================================
// TIME-BOUNDED OPERATIONS
// ============================================================================

behavior WithTimeout<T> {
  description: "Execute operation with timeout"
  
  input {
    operation: () -> T
    timeout: Duration
    onTimeout: Optional<() -> T>
  }
  
  output {
    success: T
    errors {
      TimeoutError when "Operation timed out"
    }
  }
}

entity RateLimiter {
  id: UUID
  maxRequests: Int { min: 1 }
  window: Duration
  currentCount: Int { min: 0 }
  windowStart: Timestamp
  
  invariant currentCount <= maxRequests
}

behavior RateLimit<T> {
  description: "Execute operation if within rate limit"
  
  input {
    limiter: RateLimiter
    operation: () -> T
  }
  
  output {
    success: T
    errors {
      RateLimitExceeded when "Rate limit exceeded"
    }
  }
  
  precondition {
    limiter.currentCount < limiter.maxRequests
  }
  
  effects {
    updates RateLimiter
  }
}

behavior Debounce<T> {
  description: "Execute operation only after quiet period"
  
  input {
    operation: () -> T
    quietPeriod: Duration
  }
  
  output {
    success: T
  }
}

behavior Throttle<T> {
  description: "Execute operation at most once per interval"
  
  input {
    operation: () -> T
    interval: Duration
    leading: Boolean
    trailing: Boolean
  }
  
  output {
    success: Optional<T>
  }
}
