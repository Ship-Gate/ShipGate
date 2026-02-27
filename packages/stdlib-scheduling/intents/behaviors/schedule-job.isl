/**
 * ScheduleJob Behavior
 * 
 * Schedule a job for future execution.
 */

import { Job, JobId, JobStatus, HandlerName, Priority, Duration, CronExpression } from "../domain.isl"

behavior ScheduleJob {
  description: "Schedule a job for future execution"
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Input
  // ═══════════════════════════════════════════════════════════════════════════
  
  input {
    /** Job name for identification */
    name: String { minLength: 1, maxLength: 255 }
    
    /** Handler function to invoke */
    handler: HandlerName
    
    /** Payload to pass to handler */
    payload: Map<String, Any>?
    
    // ─────────────────────────────────────────────────────────────────────────
    // Scheduling (at least one required)
    // ─────────────────────────────────────────────────────────────────────────
    
    /** Exact time to run */
    run_at: Timestamp?
    
    /** Delay from now */
    delay: Duration?
    
    /** Cron expression for recurring */
    cron: CronExpression?
    
    /** Timezone for cron evaluation */
    timezone: String? { default: "UTC" }
    
    // ─────────────────────────────────────────────────────────────────────────
    // Options
    // ─────────────────────────────────────────────────────────────────────────
    
    /** Execution priority (0-100, higher = sooner) */
    priority: Priority?
    
    /** Maximum retry attempts */
    max_attempts: Int? { min: 1, max: 10, default: 3 }
    
    /** Delay before retry */
    retry_delay: Duration? { default: 1000 }
    
    /** Unique key for deduplication */
    unique_key: String? { maxLength: 255 }
    
    /** Tags for categorization */
    tags: List<String>?
    
    /** Custom metadata */
    metadata: Map<String, Any>?
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Output
  // ═══════════════════════════════════════════════════════════════════════════
  
  output {
    success: Job
    
    errors {
      INVALID_CRON {
        message: "Invalid cron expression"
        when: "Cron expression cannot be parsed"
      }
      
      INVALID_SCHEDULE {
        message: "No schedule provided"
        when: "Must provide run_at, delay, or cron"
      }
      
      DUPLICATE_JOB {
        message: "Job with unique_key already exists"
        when: "An active job with the same unique_key exists"
        data: { existing_job_id: JobId }
      }
      
      HANDLER_NOT_FOUND {
        message: "Handler not registered"
        when: "The specified handler is not available"
        data: { handler: String }
      }
      
      INVALID_RUN_TIME {
        message: "Invalid run time"
        when: "run_at is in the past"
      }
      
      INVALID_TIMEZONE {
        message: "Invalid timezone"
        when: "Timezone string is not recognized"
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Preconditions
  // ═══════════════════════════════════════════════════════════════════════════
  
  preconditions {
    // At least one scheduling option must be provided
    input.run_at != null or input.delay != null or input.cron != null
      as "Must provide run_at, delay, or cron"
    
    // run_at must be in the future
    input.run_at != null implies input.run_at > now()
      as "run_at must be in the future"
    
    // delay must be positive
    input.delay != null implies input.delay > 0
      as "delay must be positive"
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Postconditions
  // ═══════════════════════════════════════════════════════════════════════════
  
  postconditions {
    success implies {
      // Job was created
      Job.exists(result.id)
      
      // Job is scheduled
      result.status == SCHEDULED
      
      // Job has correct handler
      result.handler == input.handler
      
      // Job has scheduled_at set
      result.scheduled_at != null
      
      // Job has correct name
      result.name == input.name
      
      // Payload preserved
      input.payload != null implies result.payload == input.payload
      
      // Unique key preserved
      input.unique_key != null implies result.unique_key == input.unique_key
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Temporal Constraints
  // ═══════════════════════════════════════════════════════════════════════════
  
  temporal {
    // API response time
    response within 100.ms (p99)
    
    // Job persistence
    eventually within 1.second: job_persisted
    
    // For immediate jobs (delay < 1s), execution should start soon
    input.delay != null and input.delay < 1000 implies {
      eventually within 2.seconds: job_started
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Invariants
  // ═══════════════════════════════════════════════════════════════════════════
  
  invariants {
    // Deduplication: unique_key ensures only one active job
    input.unique_key != null implies {
      Job.count(
        unique_key: input.unique_key, 
        status not in [COMPLETED, CANCELLED]
      ) <= 1
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Scenarios
// ═══════════════════════════════════════════════════════════════════════════

scenarios ScheduleJob {
  scenario "schedule delayed job" {
    when {
      result = ScheduleJob(
        name: "send-email",
        handler: "email.send",
        payload: { "to": "user@example.com", "subject": "Hello" },
        delay: 300000  // 5 minutes
      )
    }
    
    then {
      result is success
      result.job.status == SCHEDULED
      result.job.scheduled_at > now()
      result.job.scheduled_at <= now() + 300000
    }
  }
  
  scenario "schedule at specific time" {
    given {
      future_time = now() + 3600000  // 1 hour from now
    }
    
    when {
      result = ScheduleJob(
        name: "send-report",
        handler: "reports.send",
        run_at: future_time
      )
    }
    
    then {
      result is success
      result.job.scheduled_at == future_time
    }
  }
  
  scenario "schedule recurring job" {
    when {
      result = ScheduleJob(
        name: "daily-report",
        handler: "reports.daily",
        cron: "0 9 * * *",
        timezone: "America/New_York"
      )
    }
    
    then {
      result is success
      result.job.cron == "0 9 * * *"
      result.job.timezone == "America/New_York"
    }
  }
  
  scenario "deduplicate with unique_key" {
    given {
      existing = ScheduleJob(
        name: "process-order",
        handler: "orders.process",
        payload: { "order_id": "123" },
        unique_key: "order-123",
        delay: 60000
      )
    }
    
    when {
      result = ScheduleJob(
        name: "process-order",
        handler: "orders.process",
        payload: { "order_id": "123" },
        unique_key: "order-123",
        delay: 60000
      )
    }
    
    then {
      result is DUPLICATE_JOB
      result.error.existing_job_id == existing.job.id
      Job.count == 1
    }
  }
  
  scenario "reject past run_at" {
    given {
      past_time = now() - 60000  // 1 minute ago
    }
    
    when {
      result = ScheduleJob(
        name: "late-job",
        handler: "test.handler",
        run_at: past_time
      )
    }
    
    then {
      result is INVALID_RUN_TIME
    }
  }
  
  scenario "reject invalid cron" {
    when {
      result = ScheduleJob(
        name: "bad-cron",
        handler: "test.handler",
        cron: "invalid cron expression"
      )
    }
    
    then {
      result is INVALID_CRON
    }
  }
  
  scenario "schedule with priority" {
    when {
      result = ScheduleJob(
        name: "urgent-job",
        handler: "urgent.process",
        delay: 1000,
        priority: 100
      )
    }
    
    then {
      result is success
      result.job.priority == 100
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Chaos Tests
// ═══════════════════════════════════════════════════════════════════════════

chaos ScheduleJob {
  chaos "database failure during schedule" {
    inject { database_failure(duration: 5.seconds) }
    
    when { 
      ScheduleJob(name: "test", handler: "test.handler", delay: 60000) 
    }
    
    then {
      result is error
      Job.count == old(Job.count)  // No partial state
    }
  }
  
  chaos "high load scheduling" {
    inject { concurrent_requests(count: 1000) }
    
    when {
      parallel for i in 1..1000 {
        ScheduleJob(
          name: "load-test-${i}",
          handler: "test.handler",
          delay: 60000,
          unique_key: "load-${i}"
        )
      }
    }
    
    then {
      Job.count == 1000
      all_results are success
    }
  }
}
