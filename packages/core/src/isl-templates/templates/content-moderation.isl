# Content Moderation Domain
# Content review, reporting, and moderation workflows

domain ContentModeration {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type ContentId = String { max_length: 255 }
  
  enum ContentType {
    TEXT
    IMAGE
    VIDEO
    AUDIO
    LINK
    FILE
  }
  
  enum ModerationStatus {
    PENDING
    APPROVED
    REJECTED
    FLAGGED
    REMOVED
  }
  
  enum ReportReason {
    SPAM
    HARASSMENT
    HATE_SPEECH
    VIOLENCE
    NUDITY
    COPYRIGHT
    MISINFORMATION
    ILLEGAL
    OTHER
  }
  
  enum ModerationAction {
    APPROVE
    REJECT
    WARN
    MUTE
    SUSPEND
    BAN
    DELETE
    ESCALATE
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity ContentItem {
    id: UUID [immutable, unique]
    content_id: ContentId [unique, indexed]
    content_type: ContentType
    author_id: UUID [indexed]
    content_url: String?
    content_text: String?
    context: Map<String, Any>?
    moderation_status: ModerationStatus [default: PENDING]
    auto_flagged: Boolean [default: false]
    auto_flag_reasons: List<String>?
    ai_scores: Map<String, Decimal>?
    reviewed_by: UUID?
    reviewed_at: Timestamp?
    created_at: Timestamp [immutable, indexed]
    updated_at: Timestamp
  }
  
  entity ContentReport {
    id: UUID [immutable, unique]
    content_id: ContentId [indexed]
    reporter_id: UUID [indexed]
    reason: ReportReason
    description: String?
    evidence_urls: List<String>?
    status: String [values: ["pending", "reviewed", "dismissed"]]
    reviewed_by: UUID?
    reviewed_at: Timestamp?
    created_at: Timestamp [immutable, indexed]
    
    invariants {
      (content_id, reporter_id) rate limited  # Prevent spam reports
    }
  }
  
  entity ModerationDecision {
    id: UUID [immutable, unique]
    content_id: ContentId [indexed]
    report_ids: List<UUID>?
    moderator_id: UUID [indexed]
    action: ModerationAction
    reason: String
    notes: String?
    user_notified: Boolean [default: false]
    appeal_window_ends: Timestamp?
    created_at: Timestamp [immutable, indexed]
  }
  
  entity UserModeration {
    id: UUID [immutable, unique]
    user_id: UUID [unique, indexed]
    warnings_count: Int [default: 0]
    muted_until: Timestamp?
    suspended_until: Timestamp?
    banned_at: Timestamp?
    ban_reason: String?
    trust_score: Decimal [default: 1.0]
    content_removed_count: Int [default: 0]
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      trust_score >= 0
      trust_score <= 1
      warnings_count >= 0
    }
  }
  
  entity Appeal {
    id: UUID [immutable, unique]
    decision_id: UUID [indexed]
    user_id: UUID [indexed]
    reason: String
    evidence: String?
    status: String [values: ["pending", "approved", "rejected"]]
    reviewed_by: UUID?
    reviewed_at: Timestamp?
    outcome_notes: String?
    created_at: Timestamp [immutable]
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior ScanContent {
    description: "Automatically scan content for violations"
    
    actors {
      System { }
    }
    
    input {
      content_id: ContentId
      content_type: ContentType
      content_text: String?
      content_url: String?
      author_id: UUID
    }
    
    output {
      success: {
        item: ContentItem
        auto_approved: Boolean
        flagged: Boolean
        scores: Map<String, Decimal>
        detected_issues: List<String>?
      }
    }
    
    postconditions {
      success implies {
        ContentItem.exists(content_id: input.content_id)
        result.flagged implies ContentItem.lookup(input.content_id).moderation_status == FLAGGED
      }
    }
    
    temporal {
      response within 500ms
    }
  }
  
  behavior ReportContent {
    description: "Report content for moderation review"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      content_id: ContentId
      reason: ReportReason
      description: String?
      evidence_urls: List<String>?
    }
    
    output {
      success: ContentReport
      
      errors {
        CONTENT_NOT_FOUND {
          when: "Content does not exist"
          retriable: false
        }
        ALREADY_REPORTED {
          when: "You have already reported this content"
          retriable: false
        }
        OWN_CONTENT {
          when: "Cannot report your own content"
          retriable: false
        }
        RATE_LIMITED {
          when: "Too many reports submitted"
          retriable: true
          retry_after: 1h
        }
      }
    }
    
    postconditions {
      success implies {
        ContentReport.exists(result.id)
        // Escalate if multiple reports
        ContentReport.count(content_id: input.content_id) >= 3 implies
          ContentItem.lookup(input.content_id).moderation_status == FLAGGED
      }
    }
    
    security {
      rate_limit 10 per hour per user
    }
  }
  
  behavior ReviewContent {
    description: "Review and moderate flagged content"
    
    actors {
      Moderator { must: authenticated }
    }
    
    input {
      content_id: ContentId
      action: ModerationAction
      reason: String
      notes: String?
      user_action: ModerationAction?  # Optional action against user
    }
    
    output {
      success: {
        decision: ModerationDecision
        content: ContentItem
        user_moderation: UserModeration?
      }
      
      errors {
        CONTENT_NOT_FOUND {
          when: "Content does not exist"
          retriable: false
        }
        ALREADY_REVIEWED {
          when: "Content was already reviewed"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        ModerationDecision.exists(result.decision.id)
        input.action == APPROVE implies 
          ContentItem.lookup(input.content_id).moderation_status == APPROVED
        input.action in [REJECT, DELETE] implies
          ContentItem.lookup(input.content_id).moderation_status == REMOVED
      }
    }
    
    effects {
      Notification { notify_content_author }
      AuditLog { log_moderation_decision }
    }
  }
  
  behavior AppealDecision {
    description: "Appeal a moderation decision"
    
    actors {
      User { must: authenticated, is_content_author: true }
    }
    
    input {
      decision_id: UUID
      reason: String
      evidence: String?
    }
    
    output {
      success: Appeal
      
      errors {
        DECISION_NOT_FOUND {
          when: "Moderation decision does not exist"
          retriable: false
        }
        APPEAL_WINDOW_CLOSED {
          when: "Appeal window has expired"
          retriable: false
        }
        ALREADY_APPEALED {
          when: "Decision was already appealed"
          retriable: false
        }
      }
    }
    
    preconditions {
      ModerationDecision.lookup(input.decision_id).appeal_window_ends > now()
      not Appeal.exists(decision_id: input.decision_id)
    }
  }
  
  behavior ReviewAppeal {
    description: "Review a moderation appeal"
    
    actors {
      Moderator { must: authenticated, is_senior: true }
    }
    
    input {
      appeal_id: UUID
      approved: Boolean
      notes: String
    }
    
    output {
      success: {
        appeal: Appeal
        content_restored: Boolean?
      }
    }
    
    postconditions {
      success and input.approved implies {
        // Restore content if appeal approved
        ContentItem.lookup(appeal.content_id).moderation_status == APPROVED
      }
    }
  }
  
  behavior GetModerationQueue {
    description: "Get content pending moderation"
    
    actors {
      Moderator { must: authenticated }
    }
    
    input {
      status: ModerationStatus?
      content_type: ContentType?
      priority: String?
      limit: Int [default: 20]
    }
    
    output {
      success: {
        items: List<{
          content: ContentItem
          reports: List<ContentReport>
          report_count: Int
          author_trust_score: Decimal
        }>
        total_pending: Int
      }
    }
  }
  
  behavior SuspendUser {
    description: "Suspend a user for violations"
    
    actors {
      Moderator { must: authenticated }
    }
    
    input {
      user_id: UUID
      duration_hours: Int
      reason: String
    }
    
    output {
      success: UserModeration
    }
    
    postconditions {
      success implies {
        UserModeration.lookup(input.user_id).suspended_until == now() + duration_hours.hours
      }
    }
    
    effects {
      Email { notify_user_suspended }
      Session { revoke_all_sessions }
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios ScanContent {
    scenario "auto-approve clean content" {
      when {
        result = ScanContent(
          content_id: "post-123",
          content_type: TEXT,
          content_text: "Hello, this is a normal post!",
          author_id: user.id
        )
      }
      
      then {
        result is success
        result.auto_approved == true
        result.flagged == false
      }
    }
    
    scenario "flag suspicious content" {
      when {
        result = ScanContent(
          content_id: "post-456",
          content_type: TEXT,
          content_text: "[inappropriate content]",
          author_id: user.id
        )
      }
      
      then {
        result is success
        result.flagged == true
        result.scores["toxicity"] > 0.8
      }
    }
  }
}
