# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: WorkerInterface, WorkerEvent, WorkerConfig, WorkerStats, WorkerPoolConfig, WorkerPoolInterface, WorkerPoolEvent, WorkerPoolStats, SchedulerInterface, SchedulerEvent, JobExecutor
# dependencies: 

domain Types {
  version: "1.0.0"

  type WorkerInterface = String
  type WorkerEvent = String
  type WorkerConfig = String
  type WorkerStats = String
  type WorkerPoolConfig = String
  type WorkerPoolInterface = String
  type WorkerPoolEvent = String
  type WorkerPoolStats = String
  type SchedulerInterface = String
  type SchedulerEvent = String
  type JobExecutor = String

  invariants exports_present {
    - true
  }
}
