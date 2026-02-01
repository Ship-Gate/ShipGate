# User Feedback & Support Domain
# Feedback collection, support tickets, and user satisfaction

domain Feedback {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type Rating = Int { min: 1, max: 5 }
  type NPSScore = Int { min: 0, max: 10 }
  
  enum FeedbackType {
    BUG_REPORT
    FEATURE_REQUEST
    GENERAL
    COMPLAINT
    PRAISE
    QUESTION
  }
  
  enum TicketStatus {
    OPEN
    IN_PROGRESS
    WAITING_ON_CUSTOMER
    RESOLVED
    CLOSED
  }
  
  enum TicketPriority {
    LOW
    MEDIUM
    HIGH
    URGENT
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity Feedback {
    id: UUID [immutable, unique]
    user_id: UUID? [indexed]
    type: FeedbackType [indexed]
    title: String?
    content: String { max_length: 10000 }
    rating: Rating?
    nps_score: NPSScore?
    page_url: String?
    user_agent: String?
    screenshot_url: String?
    metadata: Map<String, Any>?
    tags: List<String>
    is_public: Boolean [default: false]
    created_at: Timestamp [immutable, indexed]
    
    invariants {
      content.length > 0
    }
  }
  
  entity SupportTicket {
    id: UUID [immutable, unique]
    ticket_number: String [unique, indexed]
    user_id: UUID [indexed]
    assignee_id: UUID? [indexed]
    subject: String { max_length: 255 }
    description: String { max_length: 50000 }
    type: FeedbackType
    status: TicketStatus [default: OPEN]
    priority: TicketPriority [default: MEDIUM]
    category: String?
    tags: List<String>
    attachments: List<{
      name: String
      url: String
      size: Int
    }>?
    first_response_at: Timestamp?
    resolved_at: Timestamp?
    satisfaction_rating: Rating?
    satisfaction_comment: String?
    metadata: Map<String, Any>?
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      resolved_at != null implies status in [RESOLVED, CLOSED]
    }
    
    lifecycle {
      OPEN -> IN_PROGRESS
      IN_PROGRESS -> WAITING_ON_CUSTOMER
      WAITING_ON_CUSTOMER -> IN_PROGRESS
      IN_PROGRESS -> RESOLVED
      RESOLVED -> CLOSED
      WAITING_ON_CUSTOMER -> RESOLVED
    }
  }
  
  entity TicketMessage {
    id: UUID [immutable, unique]
    ticket_id: UUID [indexed]
    author_id: UUID
    author_type: String [values: ["user", "agent", "system"]]
    content: String { max_length: 50000 }
    attachments: List<{
      name: String
      url: String
    }>?
    is_internal: Boolean [default: false]
    created_at: Timestamp [immutable]
  }
  
  entity NPSSurvey {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    score: NPSScore
    reason: String?
    segment: String?
    touchpoint: String?
    created_at: Timestamp [immutable, indexed]
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior SubmitFeedback {
    description: "Submit user feedback"
    
    actors {
      Anonymous { }
      User { must: authenticated }
    }
    
    input {
      type: FeedbackType
      title: String?
      content: String
      rating: Rating?
      page_url: String?
      screenshot: Binary?
      metadata: Map<String, Any>?
    }
    
    output {
      success: Feedback
      
      errors {
        RATE_LIMITED {
          when: "Too many feedback submissions"
          retriable: true
          retry_after: 1m
        }
        CONTENT_TOO_SHORT {
          when: "Feedback content is too short"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        Feedback.exists(result.id)
      }
    }
    
    security {
      rate_limit 10 per hour per user
      rate_limit 5 per hour per ip (anonymous)
    }
    
    effects {
      Notification { notify_team if type == BUG_REPORT }
    }
  }
  
  behavior CreateTicket {
    description: "Create a support ticket"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      subject: String
      description: String
      type: FeedbackType [default: QUESTION]
      priority: TicketPriority?
      category: String?
      attachments: List<Binary>?
    }
    
    output {
      success: SupportTicket
      
      errors {
        TOO_MANY_OPEN_TICKETS {
          when: "User has too many open tickets"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        SupportTicket.exists(result.id)
        result.status == OPEN
      }
    }
    
    effects {
      Email { send_ticket_confirmation }
      Notification { notify_support_team }
    }
  }
  
  behavior ReplyToTicket {
    description: "Add a reply to a support ticket"
    
    actors {
      User { must: authenticated, owns: ticket }
      Agent { must: authenticated }
    }
    
    input {
      ticket_id: UUID
      content: String
      attachments: List<Binary>?
      is_internal: Boolean?
    }
    
    output {
      success: TicketMessage
      
      errors {
        TICKET_NOT_FOUND {
          when: "Ticket does not exist"
          retriable: false
        }
        TICKET_CLOSED {
          when: "Cannot reply to closed ticket"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        TicketMessage.exists(result.id)
        actor.is_agent and input.is_internal != true implies 
          SupportTicket.lookup(input.ticket_id).first_response_at != null
      }
    }
    
    effects {
      Email { notify_other_party }
    }
  }
  
  behavior UpdateTicketStatus {
    description: "Update ticket status"
    
    actors {
      Agent { must: authenticated }
    }
    
    input {
      ticket_id: UUID
      status: TicketStatus
      resolution_note: String?
    }
    
    output {
      success: SupportTicket
    }
    
    postconditions {
      success implies {
        SupportTicket.lookup(input.ticket_id).status == input.status
        input.status == RESOLVED implies 
          SupportTicket.lookup(input.ticket_id).resolved_at == now()
      }
    }
  }
  
  behavior AssignTicket {
    description: "Assign ticket to an agent"
    
    actors {
      Agent { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      ticket_id: UUID
      assignee_id: UUID
    }
    
    output {
      success: SupportTicket
    }
  }
  
  behavior SubmitSatisfactionRating {
    description: "Submit satisfaction rating after ticket resolution"
    
    actors {
      User { must: authenticated, owns: ticket }
    }
    
    input {
      ticket_id: UUID
      rating: Rating
      comment: String?
    }
    
    output {
      success: SupportTicket
      
      errors {
        TICKET_NOT_RESOLVED {
          when: "Ticket must be resolved to rate"
          retriable: false
        }
        ALREADY_RATED {
          when: "Ticket was already rated"
          retriable: false
        }
      }
    }
  }
  
  behavior SubmitNPS {
    description: "Submit NPS survey response"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      score: NPSScore
      reason: String?
      touchpoint: String?
    }
    
    output {
      success: NPSSurvey
    }
    
    security {
      rate_limit 1 per 30d per user
    }
  }
  
  behavior GetFeedbackAnalytics {
    description: "Get feedback analytics"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      from_date: Timestamp?
      to_date: Timestamp?
      type: FeedbackType?
    }
    
    output {
      success: {
        total_feedback: Int
        by_type: Map<FeedbackType, Int>
        average_rating: Decimal?
        nps: {
          score: Int
          promoters: Int
          passives: Int
          detractors: Int
        }?
        trends: List<{
          date: Timestamp
          count: Int
          avg_rating: Decimal?
        }>
      }
    }
  }
  
  behavior GetTicketMetrics {
    description: "Get support ticket metrics"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      from_date: Timestamp?
      to_date: Timestamp?
    }
    
    output {
      success: {
        total_tickets: Int
        open_tickets: Int
        avg_first_response_time_hours: Decimal
        avg_resolution_time_hours: Decimal
        satisfaction_score: Decimal?
        by_status: Map<TicketStatus, Int>
        by_priority: Map<TicketPriority, Int>
      }
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios CreateTicket {
    scenario "create bug report ticket" {
      when {
        result = CreateTicket(
          subject: "App crashes on login",
          description: "When I try to login...",
          type: BUG_REPORT,
          priority: HIGH
        )
      }
      
      then {
        result is success
        result.ticket_number != null
        result.status == OPEN
      }
    }
  }
  
  scenarios SubmitNPS {
    scenario "promoter submission" {
      when {
        result = SubmitNPS(score: 9, reason: "Great product!")
      }
      
      then {
        result is success
        result.score == 9
      }
    }
  }
}
