# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: TimeUnit, Duration, Timestamp, TimeInterval, ClockType, DeadlineType, DeadlinePenalty, Deadline, DeadlineConstraintKind, DeadlineConstraint, RealtimeBehaviorState, RealtimeBehavior, ExecutionResult, ScheduleStatus, ScheduledTask, SchedulingPolicy, Scheduler, SchedulabilityResult, LTLFormula, MTLFormula, TraceState, Trace, TemporalVerificationResult, VerificationStats, RateLimiter, TimeoutError, DeadlineMissedError, RateLimitExceededError
# dependencies: 

domain Types {
  version: "1.0.0"

  type TimeUnit = String
  type Duration = String
  type Timestamp = String
  type TimeInterval = String
  type ClockType = String
  type DeadlineType = String
  type DeadlinePenalty = String
  type Deadline = String
  type DeadlineConstraintKind = String
  type DeadlineConstraint = String
  type RealtimeBehaviorState = String
  type RealtimeBehavior = String
  type ExecutionResult = String
  type ScheduleStatus = String
  type ScheduledTask = String
  type SchedulingPolicy = String
  type Scheduler = String
  type SchedulabilityResult = String
  type LTLFormula = String
  type MTLFormula = String
  type TraceState = String
  type Trace = String
  type TemporalVerificationResult = String
  type VerificationStats = String
  type RateLimiter = String
  type TimeoutError = String
  type DeadlineMissedError = String
  type RateLimitExceededError = String

  invariants exports_present {
    - true
  }
}
