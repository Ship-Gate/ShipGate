# Async Jobs / Queue — Canonical Sample
# Background job processing with retries, dead-letter, and progress tracking
# Covers: pre/post, invariants, temporal constraints, scenarios

domain AsyncJobs {
  version: "1.0.0"

  enum JobStatus {
    QUEUED
    RUNNING
    COMPLETED
    FAILED
    DEAD_LETTER
    CANCELLED
  }

  enum JobPriority {
    LOW
    NORMAL
    HIGH
    CRITICAL
  }

  entity Job {
    id: UUID [immutable, unique]
    queue: String [indexed]
    payload: JSON
    priority: JobPriority [default: NORMAL, indexed]
    status: JobStatus [default: QUEUED, indexed]
    attempt: Int [default: 0]
    max_retries: Int [default: 3]
    result: JSON?
    error: String?
    scheduled_at: Timestamp
    started_at: Timestamp?
    completed_at: Timestamp?
    created_at: Timestamp [immutable]

    invariants {
      attempt >= 0
      attempt <= max_retries + 1
      max_retries >= 0
      status == RUNNING implies started_at != null
      status == COMPLETED implies completed_at != null
      status == DEAD_LETTER implies attempt > max_retries
    }
  }

  entity Queue {
    name: String [immutable, unique]
    concurrency: Int [default: 5]
    is_paused: Boolean [default: false]

    invariants {
      concurrency >= 1
      concurrency <= 100
    }
  }

  behavior EnqueueJob {
    description: "Add a job to a named queue"

    input {
      queue: String
      payload: JSON
      priority: JobPriority?
      max_retries: Int?
      delay_seconds: Int?
    }

    output {
      success: Job
      errors {
        QUEUE_NOT_FOUND {
          when: "Named queue does not exist"
          retriable: false
        }
        QUEUE_PAUSED {
          when: "Queue is currently paused"
          retriable: true
          retry_after: 30s
        }
        INVALID_PAYLOAD {
          when: "Payload exceeds size limit or is malformed"
          retriable: false
        }
      }
    }

    pre {
      Queue.exists(queue)
      payload.size_bytes <= 1_048_576
    }

    post success {
      - Job.exists(result.id)
      - result.status == QUEUED
      - result.queue == input.queue
      - result.attempt == 0
      - input.delay_seconds != null implies result.scheduled_at == now() + input.delay_seconds
    }
  }

  behavior ProcessJob {
    description: "Pick up and execute the next job from a queue"

    input {
      queue: String
    }

    output {
      success: Job
      errors {
        QUEUE_EMPTY {
          when: "No jobs available to process"
          retriable: true
          retry_after: 1s
        }
        CONCURRENCY_LIMIT {
          when: "Queue has reached max concurrent jobs"
          retriable: true
          retry_after: 5s
        }
      }
    }

    pre {
      Queue.exists(queue)
      not Queue.lookup(queue).is_paused
    }

    post success {
      - result.status == RUNNING
      - result.started_at == now()
      - result.attempt == old(result.attempt) + 1
    }

    invariants {
      - running jobs for queue <= Queue.concurrency
      - CRITICAL priority jobs dequeued before NORMAL
      - job picked in FIFO order within same priority
    }
  }

  behavior CompleteJob {
    description: "Mark a running job as completed"

    input {
      job_id: UUID
      result: JSON
    }

    output {
      success: Job
      errors {
        JOB_NOT_FOUND {
          when: "Job does not exist"
          retriable: false
        }
        NOT_RUNNING {
          when: "Job is not in RUNNING status"
          retriable: false
        }
      }
    }

    pre {
      Job.exists(job_id)
      Job.lookup(job_id).status == RUNNING
    }

    post success {
      - result.status == COMPLETED
      - result.completed_at == now()
      - result.result == input.result
    }
  }

  behavior FailJob {
    description: "Report a job failure; auto-retries or moves to dead letter"

    input {
      job_id: UUID
      error: String
    }

    output {
      success: Job
      errors {
        JOB_NOT_FOUND {
          when: "Job does not exist"
          retriable: false
        }
        NOT_RUNNING {
          when: "Job is not in RUNNING status"
          retriable: false
        }
      }
    }

    pre {
      Job.exists(job_id)
      Job.lookup(job_id).status == RUNNING
    }

    post success {
      - result.attempt <= result.max_retries implies result.status == QUEUED
      - result.attempt > result.max_retries implies result.status == DEAD_LETTER
      - result.error == input.error
    }

    invariants {
      - retries use exponential backoff: delay = 2^attempt seconds
      - dead-letter jobs are never auto-retried
    }
  }

  behavior CancelJob {
    description: "Cancel a queued or running job"

    input {
      job_id: UUID
    }

    output {
      success: Job
      errors {
        JOB_NOT_FOUND {
          when: "Job does not exist"
          retriable: false
        }
        ALREADY_TERMINAL {
          when: "Job is already COMPLETED, FAILED, or DEAD_LETTER"
          retriable: false
        }
      }
    }

    pre {
      Job.exists(job_id)
      Job.lookup(job_id).status in [QUEUED, RUNNING]
    }

    post success {
      - result.status == CANCELLED
    }
  }

  scenario "Job retry then dead-letter" {
    step enqueue = EnqueueJob({ queue: "emails", payload: { to: "a@b.com" }, max_retries: 2 })
    assert enqueue.success

    step run1 = ProcessJob({ queue: "emails" })
    step fail1 = FailJob({ job_id: run1.result.id, error: "timeout" })
    assert fail1.result.status == QUEUED

    step run2 = ProcessJob({ queue: "emails" })
    step fail2 = FailJob({ job_id: run2.result.id, error: "timeout" })
    assert fail2.result.status == QUEUED

    step run3 = ProcessJob({ queue: "emails" })
    step fail3 = FailJob({ job_id: run3.result.id, error: "timeout" })
    assert fail3.result.status == DEAD_LETTER
  }

  scenario "Priority ordering" {
    step low = EnqueueJob({ queue: "work", payload: { type: "low" }, priority: LOW })
    step high = EnqueueJob({ queue: "work", payload: { type: "high" }, priority: HIGH })
    step critical = EnqueueJob({ queue: "work", payload: { type: "critical" }, priority: CRITICAL })

    step next = ProcessJob({ queue: "work" })
    assert next.result.id == critical.result.id
  }
}
