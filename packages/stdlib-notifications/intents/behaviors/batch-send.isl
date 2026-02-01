// ============================================================================
// BatchSend Behavior
// ============================================================================
// Send notifications to multiple recipients efficiently
// ============================================================================

domain Notifications {
  
  behavior BatchSend {
    description: "Send notifications to multiple recipients"
    
    actors {
      sender: {
        with_permission: "notifications:send:batch"
      }
    }
    
    // ========================================================================
    // INPUT
    // ========================================================================
    
    input {
      // Template to use for all recipients
      template_id: TemplateId
      
      // Recipients with optional per-recipient variables
      recipients: List<Recipient> {
        min_length: 1
        max_length: 1000
      }
      
      // Shared variables (applied to all recipients)
      shared_variables: Map<String, String>?
      
      // Options
      priority: NotificationPriority?
      scheduled_at: Timestamp?
      
      // Tracking
      campaign_id: String
      tags: Map<String, String>?
      
      // Error handling
      fail_fast: Boolean { default: false }  // Stop on first error
      
      // Idempotency
      idempotency_key: String?
    }
    
    // ========================================================================
    // OUTPUT
    // ========================================================================
    
    output {
      success: BatchResult
      errors {
        TEMPLATE_NOT_FOUND {
          when: "Template does not exist"
        }
        TOO_MANY_RECIPIENTS {
          when: "Exceeds 1000 recipient limit"
        }
        INVALID_RECIPIENTS {
          when: "All recipients are invalid"
          returns: { errors: List<BatchError> }
        }
        RATE_LIMITED {
          when: "Rate limit exceeded"
          retriable: true
          retry_after: 1.minute
        }
        MIXED_CHANNELS {
          when: "Recipients have different channels than template"
        }
      }
    }
    
    // ========================================================================
    // PRECONDITIONS
    // ========================================================================
    
    preconditions {
      // Template must exist and be active
      Template.exists(input.template_id)
      Template.lookup(input.template_id).active == true
      
      // Recipients count within limit
      input.recipients.length <= 1000
      input.recipients.length > 0
      
      // All recipients must match template channel
      let template_channel = Template.lookup(input.template_id).channel
      all(input.recipients, r => r.channel == template_channel)
    }
    
    // ========================================================================
    // POSTCONDITIONS
    // ========================================================================
    
    postconditions {
      success implies {
        // Total matches input
        result.total == input.recipients.length
        result.successful + result.failed == result.total
        
        // Notifications created for successful sends
        result.notifications.length == result.successful
        all(result.notifications, id => Notification.exists(id))
        
        // Campaign tracking
        all(result.notifications, id => 
          Notification.lookup(id).campaign_id == input.campaign_id
        )
        
        // Scheduling respected
        input.scheduled_at != null implies
          all(result.notifications, id =>
            Notification.lookup(id).scheduled_at == input.scheduled_at
          )
      }
    }
    
    // ========================================================================
    // INVARIANTS
    // ========================================================================
    
    invariants {
      // Idempotency for entire batch
      same(input.idempotency_key) implies same(result)
      
      // Partial success allowed (unless fail_fast)
      input.fail_fast implies (result.failed == 0 or result.successful == 0)
    }
    
    // ========================================================================
    // TEMPORAL
    // ========================================================================
    
    temporal {
      // API response time scales with batch size
      response within 5.seconds (p99)
      response within 1.second (p50)
      
      // Delivery SLA for entire batch
      eventually within 30.minutes: all(result.notifications, id =>
        Notification.lookup(id).status in [SENT, FAILED]
      )
    }
    
    // ========================================================================
    // SECURITY
    // ========================================================================
    
    security {
      requires: permission("notifications:send:batch")
      
      // Batch-specific rate limits
      rate_limit: 10.per_minute per sender  // 10 batches per minute
      rate_limit: 10000.per_hour per sender // Total recipients
    }
    
    // ========================================================================
    // OBSERVABILITY
    // ========================================================================
    
    observability {
      metrics {
        counter batch_sends { labels: [template_id, channel] }
        counter batch_recipients { labels: [template_id, channel, status] }
        histogram batch_size { labels: [channel] }
        histogram batch_processing_time { labels: [channel] }
      }
      
      traces {
        span: "batch_send"
        attributes: [template_id, channel, campaign_id, batch_size]
      }
      
      logs {
        on_success: info {
          include: [campaign_id, total, successful, failed]
        }
        on_error: warn {
          include: [campaign_id, error_code, failed_count]
        }
      }
    }
  }
  
  // ==========================================================================
  // BATCH SEND BY SEGMENT
  // ==========================================================================
  
  behavior BatchSendBySegment {
    description: "Send to all users matching a segment"
    
    input {
      template_id: TemplateId
      segment_id: String
      channel: NotificationChannel
      shared_variables: Map<String, String>?
      priority: NotificationPriority?
      scheduled_at: Timestamp?
      campaign_id: String
    }
    
    output {
      success: {
        batch_id: UUID
        estimated_recipients: Int
        status: BatchJobStatus
      }
      errors {
        TEMPLATE_NOT_FOUND { }
        SEGMENT_NOT_FOUND { when: "Segment does not exist" }
        SEGMENT_EMPTY { when: "Segment has no matching users" }
        RATE_LIMITED { retriable: true }
      }
    }
    
    postconditions {
      success implies {
        BatchJob.exists(result.batch_id)
        result.estimated_recipients >= 0
      }
    }
    
    temporal {
      // Async job - just returns job ID quickly
      response within 500.ms (p99)
    }
  }
  
  // ==========================================================================
  // BATCH JOB STATUS
  // ==========================================================================
  
  enum BatchJobStatus {
    QUEUED
    PROCESSING
    COMPLETED
    FAILED
    CANCELLED
  }
  
  behavior GetBatchStatus {
    description: "Get status of a batch send job"
    
    input {
      batch_id: UUID
    }
    
    output {
      success: {
        batch_id: UUID
        status: BatchJobStatus
        total: Int
        processed: Int
        successful: Int
        failed: Int
        started_at: Timestamp?
        completed_at: Timestamp?
        error_summary: List<{
          error_code: String
          count: Int
        }>?
      }
      errors {
        BATCH_NOT_FOUND { when: "Batch job does not exist" }
      }
    }
    
    temporal {
      response within 100.ms (p99)
    }
  }
  
  behavior CancelBatch {
    description: "Cancel a pending or in-progress batch"
    
    input {
      batch_id: UUID
    }
    
    output {
      success: {
        cancelled: Int
        already_sent: Int
      }
      errors {
        BATCH_NOT_FOUND { when: "Batch job does not exist" }
        BATCH_COMPLETED { when: "Batch has already completed" }
      }
    }
    
    preconditions {
      BatchJob.exists(input.batch_id)
      BatchJob.lookup(input.batch_id).status in [QUEUED, PROCESSING]
    }
    
    postconditions {
      success implies BatchJob.lookup(input.batch_id).status == CANCELLED
    }
  }
  
  // ==========================================================================
  // SCHEDULED CAMPAIGNS
  // ==========================================================================
  
  behavior ScheduleCampaign {
    description: "Schedule a notification campaign for future delivery"
    
    input {
      template_id: TemplateId
      campaign_id: String
      recipients: List<Recipient>?
      segment_id: String?
      channel: NotificationChannel
      shared_variables: Map<String, String>?
      scheduled_at: Timestamp
      timezone_aware: Boolean { default: false }  // Send at local time
    }
    
    output {
      success: {
        campaign_id: String
        scheduled_at: Timestamp
        estimated_recipients: Int
      }
      errors {
        TEMPLATE_NOT_FOUND { }
        INVALID_SCHEDULE { when: "Scheduled time is in the past" }
        CAMPAIGN_EXISTS { when: "Campaign ID already exists" }
      }
    }
    
    preconditions {
      input.scheduled_at > now()
      input.recipients != null or input.segment_id != null
    }
    
    temporal {
      response within 500.ms (p99)
    }
  }
}
