/**
 * RetryJob Behavior
 * 
 * Retry a failed job.
 */

import { Job, JobId, JobStatus, Duration } from "../domain.isl"

behavior RetryJob {
  description: "Retry a failed job"
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Input
  // ═══════════════════════════════════════════════════════════════════════════
  
  input {
    /** ID of the job to retry */
    job_id: JobId
    
    /** Custom delay before retry (overrides job's retry_delay) */
    delay: Duration?
    
    /** Reset attempt counter (use with caution) */
    reset_attempts: Boolean? { default: false }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Output
  // ═══════════════════════════════════════════════════════════════════════════
  
  output {
    success: Job
    
    errors {
      JOB_NOT_FOUND {
        message: "Job not found"
        when: "No job exists with the given ID"
        data: { job_id: JobId }
      }
      
      MAX_RETRIES_EXCEEDED {
        message: "Maximum retry attempts exceeded"
        when: "Job has reached max_attempts"
        data: { 
          job_id: JobId, 
          attempts: Int, 
          max_attempts: Int 
        }
      }
      
      JOB_NOT_FAILED {
        message: "Can only retry failed jobs"
        when: "Job status is not FAILED"
        data: { job_id: JobId, status: JobStatus }
      }
      
      JOB_CANCELLED {
        message: "Cannot retry cancelled job"
        when: "Job was cancelled"
        data: { job_id: JobId }
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Preconditions
  // ═══════════════════════════════════════════════════════════════════════════
  
  preconditions {
    // Job must exist
    Job.exists(input.job_id)
      as "Job must exist"
    
    // Job must be in FAILED state
    Job.lookup(input.job_id).status == FAILED
      as "Job must be in FAILED state"
    
    // Must have retries remaining (unless resetting)
    input.reset_attempts == true or
    Job.lookup(input.job_id).attempts < Job.lookup(input.job_id).max_attempts
      as "Job must have retries remaining"
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Postconditions
  // ═══════════════════════════════════════════════════════════════════════════
  
  postconditions {
    success implies {
      // Job status is now RETRYING
      Job.lookup(input.job_id).status == RETRYING
      
      // Attempt count is incremented (unless reset)
      input.reset_attempts != true implies {
        Job.lookup(input.job_id).attempts == old(Job.lookup(input.job_id).attempts) + 1
      }
      
      // Attempt count is reset if requested
      input.reset_attempts == true implies {
        Job.lookup(input.job_id).attempts == 1
      }
      
      // Scheduled_at is set for retry
      Job.lookup(input.job_id).scheduled_at != null
      
      // Scheduled time respects delay
      input.delay != null implies {
        Job.lookup(input.job_id).scheduled_at >= now() + input.delay
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Temporal Constraints
  // ═══════════════════════════════════════════════════════════════════════════
  
  temporal {
    response within 50.ms (p99)
    eventually within 500.ms: job_rescheduled
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Scenarios
// ═══════════════════════════════════════════════════════════════════════════

scenarios RetryJob {
  scenario "retry failed job" {
    given {
      job = failed_job(
        id: "failed-123",
        attempts: 1,
        max_attempts: 3,
        retry_delay: 5000
      )
    }
    
    when {
      result = RetryJob(job_id: job.id)
    }
    
    then {
      result is success
      result.job.status == RETRYING
      result.job.attempts == 2
      result.job.scheduled_at >= now() + 5000
    }
  }
  
  scenario "retry with custom delay" {
    given {
      job = failed_job(id: "failed-456", attempts: 1, max_attempts: 3)
    }
    
    when {
      result = RetryJob(job_id: job.id, delay: 30000)
    }
    
    then {
      result is success
      result.job.scheduled_at >= now() + 30000
    }
  }
  
  scenario "retry with reset attempts" {
    given {
      job = failed_job(id: "failed-789", attempts: 2, max_attempts: 3)
    }
    
    when {
      result = RetryJob(job_id: job.id, reset_attempts: true)
    }
    
    then {
      result is success
      result.job.attempts == 1
    }
  }
  
  scenario "cannot retry when max retries exceeded" {
    given {
      job = failed_job(id: "maxed-out", attempts: 3, max_attempts: 3)
    }
    
    when {
      result = RetryJob(job_id: job.id)
    }
    
    then {
      result is MAX_RETRIES_EXCEEDED
      result.error.attempts == 3
      result.error.max_attempts == 3
    }
  }
  
  scenario "cannot retry non-failed job" {
    given {
      job = scheduled_job(id: "scheduled-123")
    }
    
    when {
      result = RetryJob(job_id: job.id)
    }
    
    then {
      result is JOB_NOT_FAILED
      result.error.status == SCHEDULED
    }
  }
  
  scenario "cannot retry cancelled job" {
    given {
      job = cancelled_job(id: "cancelled-123")
    }
    
    when {
      result = RetryJob(job_id: job.id)
    }
    
    then {
      result is JOB_CANCELLED
    }
  }
  
  scenario "retry with exponential backoff" {
    given {
      job = failed_job(
        id: "backoff-123",
        attempts: 2,
        max_attempts: 5,
        retry_delay: 1000,
        retry_backoff: 2.0
      )
    }
    
    when {
      result = RetryJob(job_id: job.id)
    }
    
    then {
      result is success
      // Expected delay: 1000 * 2^(3-1) = 4000ms
      result.job.scheduled_at >= now() + 4000
    }
  }
}
