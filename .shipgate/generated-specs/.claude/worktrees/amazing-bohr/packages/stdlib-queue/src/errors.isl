# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: QueueError, QueueNotFoundError, QueuePausedError, JobNotFoundError, JobNotCancellableError, JobNotFailedError, DuplicateJobError, InvalidScheduleError, WorkerNotFoundError, BackpressureError, QueueFullError, WorkerPoolError, WorkerPoolStoppedError, WorkerPoolBusyError
# dependencies: 

domain Errors {
  version: "1.0.0"

  type QueueError = String
  type QueueNotFoundError = String
  type QueuePausedError = String
  type JobNotFoundError = String
  type JobNotCancellableError = String
  type JobNotFailedError = String
  type DuplicateJobError = String
  type InvalidScheduleError = String
  type WorkerNotFoundError = String
  type BackpressureError = String
  type QueueFullError = String
  type WorkerPoolError = String
  type WorkerPoolStoppedError = String
  type WorkerPoolBusyError = String

  invariants exports_present {
    - true
  }
}
