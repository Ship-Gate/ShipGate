# Account Deletion Domain
# Secure account deletion with grace period and data removal

domain AccountDeletion {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  enum DeletionStatus {
    PENDING
    SCHEDULED
    IN_PROGRESS
    COMPLETED
    CANCELLED
  }
  
  enum DeletionReason {
    USER_REQUEST
    INACTIVITY
    TOS_VIOLATION
    ADMIN_ACTION
    GDPR_REQUEST
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity DeletionRequest {
    id: UUID [immutable, unique]
    user_id: UUID [unique, indexed]
    reason: DeletionReason
    reason_details: String?
    status: DeletionStatus [default: PENDING]
    scheduled_for: Timestamp?
    grace_period_ends: Timestamp?
    can_cancel_until: Timestamp?
    feedback: String?
    initiated_by: UUID  # User or Admin
    confirmed_at: Timestamp?
    cancelled_at: Timestamp?
    cancelled_reason: String?
    completed_at: Timestamp?
    created_at: Timestamp [immutable]
    
    invariants {
      grace_period_ends > created_at
      can_cancel_until <= grace_period_ends
      completed_at != null implies status == COMPLETED
      cancelled_at != null implies status == CANCELLED
    }
    
    lifecycle {
      PENDING -> SCHEDULED
      SCHEDULED -> IN_PROGRESS
      SCHEDULED -> CANCELLED
      IN_PROGRESS -> COMPLETED
    }
  }
  
  entity DeletionLog {
    id: UUID [immutable, unique]
    request_id: UUID [indexed]
    data_type: String
    records_deleted: Int
    anonymized: Boolean
    completed_at: Timestamp [immutable]
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior RequestDeletion {
    description: "Request account deletion"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      password: String [sensitive]
      reason: DeletionReason [default: USER_REQUEST]
      reason_details: String?
      feedback: String?
    }
    
    output {
      success: {
        request: DeletionRequest
        grace_period_days: Int
        can_cancel_until: Timestamp
        data_to_delete: List<String>
        data_to_retain: List<String>?
      }
      
      errors {
        INVALID_PASSWORD {
          when: "Password is incorrect"
          retriable: true
        }
        DELETION_ALREADY_PENDING {
          when: "A deletion request is already pending"
          retriable: false
        }
        ACTIVE_SUBSCRIPTION {
          when: "Please cancel your subscription first"
          retriable: false
        }
        OUTSTANDING_BALANCE {
          when: "Please settle outstanding balance first"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        DeletionRequest.exists(user_id: actor.id)
        DeletionRequest.lookup(actor.id).status == SCHEDULED
        // Sessions remain active during grace period
      }
    }
    
    temporal {
      grace_period: 30 days
      response within 500ms
    }
    
    effects {
      Email { send_deletion_scheduled_notification }
      AuditLog { log_deletion_requested }
    }
  }
  
  behavior ConfirmDeletion {
    description: "Confirm deletion via email link"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      confirmation_token: String
    }
    
    output {
      success: DeletionRequest
      
      errors {
        INVALID_TOKEN {
          when: "Confirmation token is invalid"
          retriable: false
        }
        ALREADY_CONFIRMED {
          when: "Deletion was already confirmed"
          retriable: false
        }
        REQUEST_CANCELLED {
          when: "Deletion request was cancelled"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        DeletionRequest.lookup(actor.id).confirmed_at == now()
      }
    }
  }
  
  behavior CancelDeletion {
    description: "Cancel a pending deletion request"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      reason: String?
    }
    
    output {
      success: DeletionRequest
      
      errors {
        NO_PENDING_DELETION {
          when: "No pending deletion request found"
          retriable: false
        }
        CANCELLATION_PERIOD_ENDED {
          when: "Cancellation period has ended"
          retriable: false
        }
        DELETION_IN_PROGRESS {
          when: "Deletion is already in progress"
          retriable: false
        }
      }
    }
    
    preconditions {
      DeletionRequest.exists(user_id: actor.id)
      DeletionRequest.lookup(actor.id).can_cancel_until > now()
      DeletionRequest.lookup(actor.id).status == SCHEDULED
    }
    
    postconditions {
      success implies {
        DeletionRequest.lookup(actor.id).status == CANCELLED
        DeletionRequest.lookup(actor.id).cancelled_at == now()
      }
    }
    
    effects {
      Email { send_deletion_cancelled_notification }
    }
  }
  
  behavior ProcessDeletion {
    description: "Execute account deletion after grace period"
    
    actors {
      System { }
    }
    
    input {
      request_id: UUID
    }
    
    output {
      success: {
        request: DeletionRequest
        logs: List<DeletionLog>
      }
      
      errors {
        REQUEST_NOT_FOUND {
          when: "Deletion request does not exist"
          retriable: false
        }
        NOT_YET_DUE {
          when: "Grace period has not ended"
          retriable: true
        }
        PROCESSING_FAILED {
          when: "Deletion processing failed"
          retriable: true
        }
      }
    }
    
    preconditions {
      DeletionRequest.lookup(input.request_id).grace_period_ends <= now()
      DeletionRequest.lookup(input.request_id).status == SCHEDULED
    }
    
    postconditions {
      success implies {
        DeletionRequest.lookup(input.request_id).status == COMPLETED
        // User data deleted or anonymized
        User.lookup(request.user_id).deleted == true
        Session.count(user_id: request.user_id) == 0
      }
    }
    
    effects {
      // Final notification to alternative email if provided
      Email { send_deletion_complete_notification }
      AuditLog { log_deletion_completed }
    }
    
    compliance {
      gdpr {
        right_to_erasure: satisfied
        data_minimization: only retain legally required data
      }
    }
  }
  
  behavior AdminDeleteAccount {
    description: "Admin-initiated account deletion"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      user_id: UUID
      reason: DeletionReason
      reason_details: String
      skip_grace_period: Boolean [default: false]
      notify_user: Boolean [default: true]
    }
    
    output {
      success: DeletionRequest
    }
    
    postconditions {
      success implies {
        input.skip_grace_period implies 
          DeletionRequest.lookup(result.id).status == IN_PROGRESS
      }
    }
    
    effects {
      Email { notify_user if input.notify_user }
      AuditLog { log_admin_deletion }
    }
  }
  
  behavior GetDeletionStatus {
    description: "Get status of deletion request"
    
    actors {
      User { must: authenticated }
    }
    
    output {
      success: {
        status: DeletionStatus
        scheduled_for: Timestamp?
        can_cancel_until: Timestamp?
        days_remaining: Int?
      }?
    }
  }
  
  behavior ListPendingDeletions {
    description: "List all pending deletion requests (admin)"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      status: DeletionStatus?
      due_before: Timestamp?
    }
    
    output {
      success: {
        requests: List<DeletionRequest>
        total_count: Int
      }
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios RequestDeletion {
    scenario "successful deletion request" {
      when {
        result = RequestDeletion(
          password: "correct_password",
          reason: USER_REQUEST,
          feedback: "No longer need the service"
        )
      }
      
      then {
        result is success
        result.request.status == SCHEDULED
        result.grace_period_days == 30
      }
    }
  }
  
  scenarios CancelDeletion {
    scenario "cancel within grace period" {
      given {
        request = DeletionRequest.create(
          user_id: user.id,
          status: SCHEDULED,
          can_cancel_until: now() + 30d
        )
      }
      
      when {
        result = CancelDeletion(reason: "Changed my mind")
      }
      
      then {
        result is success
        result.status == CANCELLED
      }
    }
    
    scenario "cannot cancel after grace period" {
      given {
        request = DeletionRequest.create(
          user_id: user.id,
          status: SCHEDULED,
          can_cancel_until: now() - 1d
        )
      }
      
      when {
        result = CancelDeletion()
      }
      
      then {
        result is CANCELLATION_PERIOD_ENDED
      }
    }
  }
}
