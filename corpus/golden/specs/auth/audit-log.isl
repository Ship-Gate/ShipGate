// Authentication: Security audit logging
domain AuthAuditLog {
  version: "1.0.0"

  enum AuditAction {
    LOGIN
    LOGOUT
    LOGIN_FAILED
    PASSWORD_CHANGED
    PASSWORD_RESET_REQUESTED
    PASSWORD_RESET_COMPLETED
    MFA_ENABLED
    MFA_DISABLED
    MFA_CHALLENGE_PASSED
    MFA_CHALLENGE_FAILED
    API_KEY_CREATED
    API_KEY_REVOKED
    ROLE_CHANGED
    PERMISSION_GRANTED
    PERMISSION_REVOKED
    SESSION_REVOKED
    ACCOUNT_LOCKED
    ACCOUNT_UNLOCKED
  }

  enum AuditSeverity {
    INFO
    WARNING
    CRITICAL
  }

  entity AuditLog {
    id: UUID [immutable, unique]
    actor_id: UUID? [indexed]
    target_id: UUID? [indexed]
    action: AuditAction
    severity: AuditSeverity
    ip_address: String? [pii]
    user_agent: String?
    location: String?
    details: Map<String, String>
    success: Boolean
    error_code: String?
    timestamp: Timestamp [immutable, indexed]

    invariants {
      timestamp <= now()
    }
  }

  behavior LogAuditEvent {
    description: "Record a security audit event"

    actors {
      System { }
    }

    input {
      actor_id: UUID?
      target_id: UUID?
      action: AuditAction
      severity: AuditSeverity?
      ip_address: String?
      user_agent: String?
      details: Map<String, String>?
      success: Boolean
      error_code: String?
    }

    output {
      success: AuditLog
    }

    post success {
      - AuditLog.exists(result.id)
      - result.action == input.action
      - result.timestamp <= now()
    }

    invariants {
      - audit logs are append-only
      - audit logs cannot be modified
      - audit logs cannot be deleted
    }

    temporal {
      - within 100ms (p99): event logged
      - eventually within 1s: event persisted
    }
  }

  behavior QueryAuditLogs {
    description: "Search audit logs with filters"

    actors {
      Admin { must: authenticated }
      SecurityTeam { must: authenticated }
    }

    input {
      actor_id: UUID?
      target_id: UUID?
      actions: List<AuditAction>?
      severity: AuditSeverity?
      from: Timestamp?
      to: Timestamp?
      ip_address: String?
      success_only: Boolean?
      failure_only: Boolean?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        logs: List<AuditLog>
        total_count: Int
        page: Int
        page_size: Int
      }
    }

    pre {
      input.page == null or input.page >= 1
      input.page_size == null or (input.page_size >= 1 and input.page_size <= 1000)
      input.from == null or input.to == null or input.from <= input.to
    }

    post success {
      - result.logs.length <= result.page_size
      - input.actor_id != null implies all(l in result.logs: l.actor_id == input.actor_id)
      - input.severity != null implies all(l in result.logs: l.severity == input.severity)
    }
  }

  behavior GetUserAuditHistory {
    description: "Get audit history for a specific user"

    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      user_id: UUID
      from: Timestamp?
      to: Timestamp?
      limit: Int?
    }

    output {
      success: List<AuditLog>

      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized to view audit history"
          retriable: false
        }
      }
    }

    pre {
      actor.id == input.user_id or actor.role >= ADMIN
    }

    post success {
      - all(l in result: l.actor_id == input.user_id or l.target_id == input.user_id)
    }
  }

  behavior ExportAuditLogs {
    description: "Export audit logs for compliance"

    actors {
      SecurityTeam { must: authenticated }
      Compliance { must: authenticated }
    }

    input {
      from: Timestamp
      to: Timestamp
      format: String
    }

    output {
      success: {
        export_id: UUID
        download_url: String
        expires_at: Timestamp
        record_count: Int
      }

      errors {
        RANGE_TOO_LARGE {
          when: "Date range exceeds maximum"
          retriable: false
        }
        EXPORT_IN_PROGRESS {
          when: "Another export is in progress"
          retriable: true
          retry_after: 5m
        }
      }
    }

    pre {
      input.to > input.from
      (input.to - input.from) <= 90.days
    }

    temporal {
      - eventually within 30m: export ready
    }

    compliance {
      - exports are logged
      - download URLs are single-use
      - exports expire after 24 hours
    }
  }

  behavior GetSecuritySummary {
    description: "Get security event summary"

    actors {
      Admin { must: authenticated }
      SecurityTeam { must: authenticated }
    }

    input {
      from: Timestamp?
      to: Timestamp?
    }

    output {
      success: {
        total_events: Int
        by_action: Map<AuditAction, Int>
        by_severity: Map<AuditSeverity, Int>
        failed_logins: Int
        successful_logins: Int
        password_resets: Int
        mfa_events: Int
        suspicious_ips: List<String>
      }
    }
  }

  scenarios LogAuditEvent {
    scenario "log successful login" {
      when {
        result = LogAuditEvent(
          actor_id: "user-123",
          action: LOGIN,
          ip_address: "1.2.3.4",
          success: true
        )
      }

      then {
        result is success
        result.action == LOGIN
        result.success == true
      }
    }

    scenario "log failed login" {
      when {
        result = LogAuditEvent(
          actor_id: null,
          action: LOGIN_FAILED,
          ip_address: "1.2.3.4",
          success: false,
          error_code: "INVALID_CREDENTIALS",
          details: { "email": "attacker@example.com" }
        )
      }

      then {
        result is success
        result.success == false
      }
    }
  }

  invariants {
    // Audit logs are immutable
    all(log in AuditLog: log.timestamp == old(log.timestamp))
    all(log in AuditLog: log.action == old(log.action))
    all(log in AuditLog: log.details == old(log.details))
  }
}
