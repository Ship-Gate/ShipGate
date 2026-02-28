# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: QueueId, JobId, WorkerId, QueueConfig, Queue, JobError, Job, JobHandler, JobResult, EnqueueOptions, BulkEnqueueResult, Worker, WorkerOptions, BackpressureStrategy, BackpressureConfig, JobStore, QueueMetrics, ProcessOptions, ScheduledJob, Schedule, JobProcessor, WorkerPool, WorkerPoolStats, QueueOptions, FIFOQueueOptions, PriorityQueueOptions, DelayQueueOptions, BoundedQueueOptions
# dependencies: 

domain Types {
  version: "1.0.0"

  type QueueId = String
  type JobId = String
  type WorkerId = String
  type QueueConfig = String
  type Queue = String
  type JobError = String
  type Job = String
  type JobHandler = String
  type JobResult = String
  type EnqueueOptions = String
  type BulkEnqueueResult = String
  type Worker = String
  type WorkerOptions = String
  type BackpressureStrategy = String
  type BackpressureConfig = String
  type JobStore = String
  type QueueMetrics = String
  type ProcessOptions = String
  type ScheduledJob = String
  type Schedule = String
  type JobProcessor = String
  type WorkerPool = String
  type WorkerPoolStats = String
  type QueueOptions = String
  type FIFOQueueOptions = String
  type PriorityQueueOptions = String
  type DelayQueueOptions = String
  type BoundedQueueOptions = String

  invariants exports_present {
    - true
  }
}
