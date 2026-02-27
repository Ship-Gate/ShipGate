# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: JobStore, JobProcessor, RetryPolicy, BackoffStrategy, CustomBackoff, JobTracker, JobHistoryEntry, JobEvent, JobDependencyGraph, JobPriorityQueue, JobMetrics, JobEventListener, JobValidator, ValidationResult, JobSerializer, JobDeduplicator
# dependencies: 

domain Types {
  version: "1.0.0"

  type JobStore = String
  type JobProcessor = String
  type RetryPolicy = String
  type BackoffStrategy = String
  type CustomBackoff = String
  type JobTracker = String
  type JobHistoryEntry = String
  type JobEvent = String
  type JobDependencyGraph = String
  type JobPriorityQueue = String
  type JobMetrics = String
  type JobEventListener = String
  type JobValidator = String
  type ValidationResult = String
  type JobSerializer = String
  type JobDeduplicator = String

  invariants exports_present {
    - true
  }
}
