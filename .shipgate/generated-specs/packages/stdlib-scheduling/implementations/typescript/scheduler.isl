# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isValidCronExpression, parseCronExpression, getNextCronRun, parseDuration, formatDuration, createScheduler, scheduleJob, cancelJob, retryJob, getJob, listJobs, JOB_STATUSES, DEFAULT_PRIORITY, DEFAULT_MAX_ATTEMPTS, DEFAULT_RETRY_DELAY, JobId, WorkflowId, Priority, JobStatus, RetryPolicy, JobResult, ScheduleConfig, Job, Schedule, JobHandler, JobContext, HandlerRegistry, ScheduleJobInput, ScheduleJobOutput, CancelJobInput, CancelJobOutput, RetryJobInput, RetryJobOutput, SchedulerEvent, JobEvent, SchedulingError, JobNotFoundError, DuplicateJobError, InvalidCronError, MaxRetriesExceededError, WorkflowValidationError, SchedulerOptions, Scheduler
# dependencies: uuid, cron-parser

domain Scheduler {
  version: "1.0.0"

  type JobId = String
  type WorkflowId = String
  type Priority = String
  type JobStatus = String
  type RetryPolicy = String
  type JobResult = String
  type ScheduleConfig = String
  type Job = String
  type Schedule = String
  type JobHandler = String
  type JobContext = String
  type HandlerRegistry = String
  type ScheduleJobInput = String
  type ScheduleJobOutput = String
  type CancelJobInput = String
  type CancelJobOutput = String
  type RetryJobInput = String
  type RetryJobOutput = String
  type SchedulerEvent = String
  type JobEvent = String
  type SchedulingError = String
  type JobNotFoundError = String
  type DuplicateJobError = String
  type InvalidCronError = String
  type MaxRetriesExceededError = String
  type WorkflowValidationError = String
  type SchedulerOptions = String
  type Scheduler = String

  invariants exports_present {
    - true
  }
}
