/**
 * CancelJob Behavior
 * 
 * Cancel a scheduled or pending job.
 */

import { Job, JobId, JobStatus } from "../domain.isl"

behavior CancelJob {
  description: "Cancel a scheduled or pending job"
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Input
  // ═══════════════════════════════════════════════════════════════════════════
  
  input {
    /** ID of the job to cancel */
    job_id: JobId
    
    /** Reason for cancellation (optional) */
    reason: String? { maxLength: 1000 }
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
      
      JOB_ALREADY_COMPLETED {
        message: "Cannot cancel completed job"
        when: "Job has already completed successfully"
        data: { job_id: JobId, completed_at: Timestamp }
      }
      
      JOB_ALREADY_CANCELLED {
        message: "Job already cancelled"
        when: "Job was previously cancelled"
        data: { job_id: JobId }
      }
      
      JOB_RUNNING {
        message: "Cannot cancel running job"
        when: "Job is currently executing"
        data: { job_id: JobId, started_at: Timestamp }
        hint: "Wait for completion or use force_cancel"
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
    
    // Job must be in cancellable state
    Job.lookup(input.job_id).status in [PENDING, SCHEDULED, FAILED, RETRYING]
      as "Job must be in cancellable state"
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Postconditions
  // ═══════════════════════════════════════════════════════════════════════════
  
  postconditions {
    success implies {
      // Job status is now CANCELLED
      Job.lookup(input.job_id).status == CANCELLED
      
      // Reason is recorded if provided
      input.reason != null implies Job.lookup(input.job_id).last_error == input.reason
      
      // Updated timestamp is set
      Job.lookup(input.job_id).updated_at >= old(Job.lookup(input.job_id).updated_at)
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Temporal Constraints
  // ═══════════════════════════════════════════════════════════════════════════
  
  temporal {
    response within 50.ms (p99)
    eventually within 500.ms: job_cancelled
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Scenarios
// ═══════════════════════════════════════════════════════════════════════════

scenarios CancelJob {
  scenario "cancel pending job" {
    given {
      job = ScheduleJob(
        name: "to-cancel",
        handler: "test.handler",
        delay: 60000
      ).job
    }
    
    when {
      result = CancelJob(job_id: job.id, reason: "No longer needed")
    }
    
    then {
      result is success
      result.job.status == CANCELLED
      result.job.last_error == "No longer needed"
    }
  }
  
  scenario "cancel scheduled job" {
    given {
      job = ScheduleJob(
        name: "scheduled-cancel",
        handler: "test.handler",
        run_at: now() + 3600000
      ).job
    }
    
    when {
      result = CancelJob(job_id: job.id)
    }
    
    then {
      result is success
      result.job.status == CANCELLED
    }
  }
  
  scenario "cannot cancel completed job" {
    given {
      job = completed_job(id: "completed-123")
    }
    
    when {
      result = CancelJob(job_id: job.id)
    }
    
    then {
      result is JOB_ALREADY_COMPLETED
      job.status == COMPLETED  // Unchanged
    }
  }
  
  scenario "cannot cancel running job" {
    given {
      job = running_job(id: "running-123")
    }
    
    when {
      result = CancelJob(job_id: job.id)
    }
    
    then {
      result is JOB_RUNNING
      job.status == RUNNING  // Unchanged
    }
  }
  
  scenario "cancel non-existent job" {
    when {
      result = CancelJob(job_id: "non-existent-id")
    }
    
    then {
      result is JOB_NOT_FOUND
    }
  }
  
  scenario "cancel failed job awaiting retry" {
    given {
      job = failed_job(id: "failed-123", attempts: 1, max_attempts: 3)
    }
    
    when {
      result = CancelJob(job_id: job.id, reason: "Giving up")
    }
    
    then {
      result is success
      result.job.status == CANCELLED
    }
  }
}
