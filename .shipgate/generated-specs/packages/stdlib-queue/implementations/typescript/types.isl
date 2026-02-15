# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_QUEUE_CONFIG, QueueId, JobId, WorkerId, Duration, RateLimitConfig, QueueConfig, Queue, JobError, Job, JobHandler, JobResult, Schedule, ScheduledJob, Worker, EnqueueOptions, EnqueueResult, BulkJobInput, BulkEnqueueResult, ProcessOptions, CreateScheduleOptions
# dependencies: 

domain Types {
  version: "1.0.0"

  type QueueId = String
  type JobId = String
  type WorkerId = String
  type Duration = String
  type RateLimitConfig = String
  type QueueConfig = String
  type Queue = String
  type JobError = String
  type Job = String
  type JobHandler = String
  type JobResult = String
  type Schedule = String
  type ScheduledJob = String
  type Worker = String
  type EnqueueOptions = String
  type EnqueueResult = String
  type BulkJobInput = String
  type BulkEnqueueResult = String
  type ProcessOptions = String
  type CreateScheduleOptions = String

  invariants exports_present {
    - true
  }
}
