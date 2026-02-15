# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createScheduler, SchedulerConfig, ScheduledTask, TaskStatus, TaskState, BehaviorScheduler, SchedulerStats
# dependencies: 

domain Scheduler {
  version: "1.0.0"

  type SchedulerConfig = String
  type ScheduledTask = String
  type TaskStatus = String
  type TaskState = String
  type BehaviorScheduler = String
  type SchedulerStats = String

  invariants exports_present {
    - true
  }
}
