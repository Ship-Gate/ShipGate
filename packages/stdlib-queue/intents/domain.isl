# Queue & Job Processing Standard Library
# Message queues, background jobs, and task scheduling

domain Queue {
  version: "1.0.0"
  description: "Asynchronous job processing and message queues"
  
  imports {
    core from "@intentos/stdlib-core"
  }
  
  # ============================================
  # Core Types
  # ============================================
  
  type QueueId = String
  type JobId = UUID
  type WorkerId = String
  
  # ============================================
  # Queue Definition
  # ============================================
  
  entity Queue {
    id: QueueId [unique]
    name: String
    
    # Configuration
    config: QueueConfig
    
    # State
    status: QueueStatus
    
    # Metrics
    size: Int
    processing: Int
    delayed: Int
    failed: Int
    completed: Int
    
    # Timestamps
    created_at: Timestamp
    
    invariants {
      config.max_retries >= 0
      config.visibility_timeout > 0
    }
  }
  
  type QueueConfig = {
    # Processing
    max_retries: Int = 3
    visibility_timeout: Duration = 30.seconds
    
    # Batching
    batch_size: Int = 1
    
    # Ordering
    fifo: Boolean = false
    
    # Dead letter
    dead_letter_queue: QueueId?
    dead_letter_threshold: Int = 3
    
    # Rate limiting
    rate_limit: {
      max_per_second: Int
      burst: Int?
    }?
    
    # Concurrency
    max_concurrency: Int = 10
    
    # Retention
    completed_job_retention: Duration = 24.hours
    failed_job_retention: Duration = 7.days
  }
  
  enum QueueStatus {
    ACTIVE
    PAUSED
    DRAINING
    DELETED
  }
  
  # ============================================
  # Job Definition
  # ============================================
  
  entity Job {
    id: JobId [immutable, unique]
    queue_id: QueueId
    
    # Job identity
    name: String
    
    # Payload
    data: Any
    
    # State
    status: JobStatus
    progress: Float? [min: 0, max: 100]
    
    # Scheduling
    priority: Int = 0
    delay: Duration?
    scheduled_for: Timestamp?
    
    # Execution
    attempts: Int = 0
    max_attempts: Int
    
    # Timing
    created_at: Timestamp
    started_at: Timestamp?
    completed_at: Timestamp?
    failed_at: Timestamp?
    
    # Result
    result: Any?
    error: JobError?
    
    # Metadata
    parent_id: JobId?
    children_ids: List<JobId>?
    
    # Tracing
    correlation_id: UUID?
    trace_id: String?
    
    lifecycle {
      WAITING -> ACTIVE [on: dequeue]
      WAITING -> DELAYED [on: delay_set]
      DELAYED -> WAITING [on: delay_expired]
      ACTIVE -> COMPLETED [on: success]
      ACTIVE -> FAILED [on: failure]
      FAILED -> WAITING [on: retry]
      FAILED -> DEAD [on: max_retries]
      WAITING -> CANCELLED [on: cancel]
      ACTIVE -> CANCELLED [on: cancel]
    }
    
    invariants {
      attempts <= max_attempts
      progress == null or (progress >= 0 and progress <= 100)
    }
  }
  
  enum JobStatus {
    WAITING     { description: "In queue, waiting to be processed" }
    DELAYED     { description: "Scheduled for future processing" }
    ACTIVE      { description: "Currently being processed" }
    COMPLETED   { description: "Successfully completed" }
    FAILED      { description: "Failed, may retry" }
    DEAD        { description: "Failed permanently, moved to DLQ" }
    CANCELLED   { description: "Cancelled by user" }
  }
  
  type JobError = {
    message: String
    code: String?
    stack_trace: String?
    attempt: Int
    timestamp: Timestamp
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior Enqueue {
    description: "Add a job to the queue"
    
    input {
      queue_id: QueueId
      name: String
      data: Any
      
      options: {
        priority: Int?
        delay: Duration?
        scheduled_for: Timestamp?
        max_attempts: Int?
        
        # Job uniqueness
        dedupe_key: String?
        dedupe_window: Duration?
        
        # Parent/child
        parent_id: JobId?
        
        # Metadata
        correlation_id: UUID?
      }?
    }
    
    output {
      success: {
        job_id: JobId
        status: JobStatus
      }
      errors {
        QUEUE_NOT_FOUND { }
        QUEUE_PAUSED { }
        DUPLICATE_JOB {
          when: "Job with same dedupe_key exists"
          fields { existing_job_id: JobId }
        }
      }
    }
    
    postconditions {
      success implies {
        Job.exists(result.job_id)
        queue.size == old(queue.size) + 1
      }
    }
  }
  
  behavior EnqueueBulk {
    description: "Add multiple jobs to the queue"
    
    input {
      queue_id: QueueId
      jobs: List<{
        name: String
        data: Any
        options: Map<String, Any>?
      }> [min_length: 1, max_length: 1000]
    }
    
    output {
      success: {
        job_ids: List<JobId>
        enqueued: Int
        failed: Int
      }
    }
  }
  
  behavior Process {
    description: "Process jobs from a queue"
    
    input {
      queue_id: QueueId
      handler: JobHandler
      options: {
        concurrency: Int = 1
        batch_size: Int = 1
      }?
    }
    
    output {
      success: Stream<JobResult>
    }
    
    effects {
      dequeues jobs
      executes handler
      updates job status
    }
  }
  
  type JobHandler = (job: Job) -> JobResult
  
  type JobResult = {
    job_id: JobId
    status: JobStatus
    result: Any?
    error: JobError?
    duration_ms: Int
  }
  
  behavior GetJob {
    input {
      job_id: JobId
    }
    
    output {
      success: { job: Job }
      errors {
        JOB_NOT_FOUND { }
      }
    }
  }
  
  behavior CancelJob {
    input {
      job_id: JobId
      reason: String?
    }
    
    output {
      success: { job: Job }
      errors {
        JOB_NOT_FOUND { }
        JOB_NOT_CANCELLABLE {
          when: "Job is already completed or dead"
        }
      }
    }
    
    preconditions {
      job.status in [WAITING, DELAYED, ACTIVE]
    }
  }
  
  behavior RetryJob {
    input {
      job_id: JobId
    }
    
    output {
      success: { job: Job }
      errors {
        JOB_NOT_FOUND { }
        JOB_NOT_FAILED {
          when: "Job is not in failed state"
        }
      }
    }
    
    preconditions {
      job.status == FAILED
    }
    
    postconditions {
      job.status == WAITING
      job.attempts preserved
    }
  }
  
  behavior UpdateProgress {
    description: "Update job progress during processing"
    
    input {
      job_id: JobId
      progress: Float [min: 0, max: 100]
      message: String?
    }
    
    output {
      success: { }
    }
  }
  
  behavior PauseQueue {
    input {
      queue_id: QueueId
    }
    
    output {
      success: { queue: Queue }
    }
    
    postconditions {
      queue.status == PAUSED
    }
  }
  
  behavior ResumeQueue {
    input {
      queue_id: QueueId
    }
    
    output {
      success: { queue: Queue }
    }
    
    postconditions {
      queue.status == ACTIVE
    }
  }
  
  behavior DrainQueue {
    description: "Process remaining jobs then pause"
    
    input {
      queue_id: QueueId
      timeout: Duration?
    }
    
    output {
      success: {
        drained: Int
        remaining: Int
      }
    }
  }
  
  behavior CleanQueue {
    description: "Remove old completed/failed jobs"
    
    input {
      queue_id: QueueId
      status: List<JobStatus>?
      older_than: Duration?
    }
    
    output {
      success: { removed: Int }
    }
  }
  
  # ============================================
  # Job Patterns
  # ============================================
  
  # Parent-child job pattern
  behavior SpawnChildJob {
    description: "Create a child job from a parent"
    
    input {
      parent_id: JobId
      name: String
      data: Any
      wait_for_completion: Boolean = false
    }
    
    output {
      success: { child: Job }
    }
  }
  
  behavior WaitForChildren {
    description: "Wait for all child jobs to complete"
    
    input {
      parent_id: JobId
      timeout: Duration?
    }
    
    output {
      success: {
        children: List<Job>
        all_completed: Boolean
      }
    }
  }
  
  # Job chaining pattern
  behavior ChainJobs {
    description: "Create a chain of jobs that execute sequentially"
    
    input {
      queue_id: QueueId
      jobs: List<{
        name: String
        data: Any
      }>
    }
    
    output {
      success: {
        chain_id: UUID
        job_ids: List<JobId>
      }
    }
  }
  
  # Fan-out/Fan-in pattern
  behavior FanOut {
    description: "Split work into parallel jobs"
    
    input {
      queue_id: QueueId
      name: String
      items: List<Any>
      batch_size: Int = 1
    }
    
    output {
      success: {
        parent_id: JobId
        child_ids: List<JobId>
      }
    }
  }
  
  # ============================================
  # Scheduled/Recurring Jobs
  # ============================================
  
  entity ScheduledJob {
    id: UUID [unique]
    queue_id: QueueId
    
    name: String
    data: Any
    
    # Schedule
    schedule: Schedule
    timezone: String = "UTC"
    
    # State
    enabled: Boolean = true
    next_run_at: Timestamp?
    last_run_at: Timestamp?
    last_job_id: JobId?
    
    # Behavior on overlap
    overlap_behavior: OverlapBehavior = SKIP
  }
  
  type Schedule = {
    cron: String?  # "0 0 * * *"
    interval: Duration?
    at: List<Time>?
  }
  
  enum OverlapBehavior {
    SKIP     { description: "Skip if previous is still running" }
    ENQUEUE  { description: "Enqueue anyway" }
    CANCEL   { description: "Cancel previous and start new" }
  }
  
  behavior CreateSchedule {
    input {
      queue_id: QueueId
      name: String
      data: Any
      schedule: Schedule
      options: {
        timezone: String?
        enabled: Boolean?
        overlap_behavior: OverlapBehavior?
      }?
    }
    
    output {
      success: { scheduled_job: ScheduledJob }
      errors {
        INVALID_SCHEDULE { }
        QUEUE_NOT_FOUND { }
      }
    }
  }
  
  behavior UpdateSchedule {
    input {
      schedule_id: UUID
      schedule: Schedule?
      enabled: Boolean?
      data: Any?
    }
    
    output {
      success: { scheduled_job: ScheduledJob }
    }
  }
  
  behavior DeleteSchedule {
    input {
      schedule_id: UUID
    }
    
    output {
      success: { }
    }
  }
  
  # ============================================
  # Worker Management
  # ============================================
  
  entity Worker {
    id: WorkerId [unique]
    
    # Identity
    hostname: String
    pid: Int
    
    # State
    status: WorkerStatus
    started_at: Timestamp
    last_heartbeat_at: Timestamp
    
    # Current work
    queues: List<QueueId>
    current_jobs: List<JobId>
    
    # Stats
    jobs_processed: Int
    jobs_failed: Int
    avg_processing_time_ms: Float
  }
  
  enum WorkerStatus {
    STARTING
    RUNNING
    PAUSED
    STOPPING
    STOPPED
  }
  
  behavior RegisterWorker {
    input {
      queues: List<QueueId>
      hostname: String?
    }
    
    output {
      success: { worker: Worker }
    }
  }
  
  behavior Heartbeat {
    input {
      worker_id: WorkerId
      current_jobs: List<JobId>?
    }
    
    output {
      success: { }
    }
  }
  
  behavior StopWorker {
    input {
      worker_id: WorkerId
      graceful: Boolean = true
      timeout: Duration?
    }
    
    output {
      success: {
        jobs_in_progress: Int
        jobs_returned: Int
      }
    }
  }
}
