# Audit / Compliance — Canonical Sample
# Immutable audit trail with tamper detection, retention policies, and compliance queries
# Covers: pre/post, invariants, temporal, scenarios

domain AuditCompliance {
  version: "1.0.0"

  enum AuditAction {
    CREATE
    READ
    UPDATE
    DELETE
    LOGIN
    LOGOUT
    PERMISSION_CHANGE
    EXPORT
    ADMIN_OVERRIDE
  }

  enum Severity {
    INFO
    WARNING
    CRITICAL
  }

  enum RetentionPolicy {
    STANDARD_90D
    EXTENDED_1Y
    REGULATORY_7Y
    PERMANENT
  }

  entity AuditEntry {
    id: UUID [immutable, unique]
    actor_id: UUID [immutable, indexed]
    action: AuditAction [immutable, indexed]
    resource_type: String [immutable, indexed]
    resource_id: UUID [immutable, indexed]
    severity: Severity [immutable, default: INFO]
    details: JSON [immutable]
    ip_address: String [immutable]
    checksum: String [immutable]
    previous_checksum: String? [immutable]
    created_at: Timestamp [immutable, indexed]

    invariants {
      all fields are immutable after creation
      checksum == sha256(actor_id + action + resource_type + resource_id + details + previous_checksum)
      previous_checksum == null implies this is the first entry in chain
      previous_checksum != null implies AuditEntry.exists_with_checksum(previous_checksum)
    }
  }

  entity RetentionRule {
    id: UUID [immutable, unique]
    resource_type: String [indexed]
    action: AuditAction? [indexed]
    policy: RetentionPolicy
    min_severity: Severity [default: INFO]

    invariants {
      CRITICAL severity entries always use REGULATORY_7Y or PERMANENT
    }
  }

  behavior RecordAuditEntry {
    description: "Append an immutable audit entry to the log"

    input {
      actor_id: UUID
      action: AuditAction
      resource_type: String
      resource_id: UUID
      severity: Severity?
      details: JSON
      ip_address: String
    }

    output {
      success: AuditEntry
      errors {
        INVALID_ACTOR {
          when: "Actor does not exist in the system"
          retriable: false
        }
        CHAIN_INTEGRITY_ERROR {
          when: "Previous checksum does not match latest entry"
          retriable: true
        }
      }
    }

    pre {
      actor_id.is_valid
      resource_id.is_valid
      details.size_bytes <= 65536
    }

    post success {
      - AuditEntry.exists(result.id)
      - result.checksum == sha256(input fields + result.previous_checksum)
      - result.previous_checksum == old(AuditEntry.latest().checksum) or result.previous_checksum == null
      - result.created_at == now()
    }

    invariants {
      - entries are append-only: no update, no delete
      - checksum chain links each entry to its predecessor
      - recording must succeed even under high load (no silent drops)
    }

    temporal {
      within 50ms (p99): entry persisted
      eventually within 1s: entry indexed and queryable
    }
  }

  behavior QueryAuditLog {
    description: "Search audit entries with filters"

    input {
      actor_id: UUID?
      action: AuditAction?
      resource_type: String?
      resource_id: UUID?
      severity_min: Severity?
      from_date: Timestamp?
      to_date: Timestamp?
      limit: Int [default: 100]
      offset: Int [default: 0]
    }

    output {
      success: {
        entries: List<AuditEntry>
        total: Int
      }
      errors {
        INVALID_DATE_RANGE {
          when: "from_date is after to_date"
          retriable: true
        }
      }
    }

    pre {
      limit > 0
      limit <= 1000
      offset >= 0
      from_date == null or to_date == null or from_date <= to_date
    }

    post success {
      - result.entries.length <= input.limit
      - result.entries.all(e => input.actor_id == null or e.actor_id == input.actor_id)
      - result.entries.all(e => input.action == null or e.action == input.action)
      - result.entries sorted by created_at descending
    }
  }

  behavior VerifyChainIntegrity {
    description: "Verify the audit log has not been tampered with"

    input {
      from_entry_id: UUID?
      to_entry_id: UUID?
    }

    output {
      success: {
        valid: Boolean
        entries_checked: Int
        first_broken_entry_id: UUID?
      }
      errors {
        ENTRY_NOT_FOUND {
          when: "Specified entry ID does not exist"
          retriable: false
        }
      }
    }

    post success {
      - result.valid == true implies all checksums in range are correct
      - result.valid == false implies result.first_broken_entry_id != null
      - result.entries_checked >= 1
    }

    invariants {
      - verification is read-only: no mutations
      - if any checksum mismatch found, CRITICAL alert emitted
    }
  }

  behavior ExportComplianceReport {
    description: "Export audit data for regulatory compliance"

    input {
      resource_type: String
      from_date: Timestamp
      to_date: Timestamp
      format: String [default: "json"]
      requesting_actor_id: UUID
    }

    output {
      success: {
        download_url: String
        entry_count: Int
        report_checksum: String
      }
      errors {
        ACCESS_DENIED {
          when: "Actor does not have compliance export permission"
          retriable: false
        }
        DATE_RANGE_TOO_LARGE {
          when: "Export range exceeds 1 year"
          retriable: true
        }
      }
    }

    pre {
      from_date < to_date
      to_date - from_date <= 365 days
    }

    post success {
      - result.entry_count >= 0
      - result.report_checksum is valid sha256
      - AuditEntry recorded for this export action itself
    }

    invariants {
      - export itself is audit-logged (action = EXPORT)
      - exported data matches live data at time of export
    }
  }

  scenario "Tamper detection" {
    step e1 = RecordAuditEntry({ actor_id: admin, action: CREATE, resource_type: "User", resource_id: u1, details: {}, ip_address: "10.0.0.1" })
    step e2 = RecordAuditEntry({ actor_id: admin, action: UPDATE, resource_type: "User", resource_id: u1, details: { field: "role" }, ip_address: "10.0.0.1" })
    assert e2.result.previous_checksum == e1.result.checksum

    step verify = VerifyChainIntegrity({})
    assert verify.result.valid == true

    # If e1 were tampered with, chain would break
    # Simulated: verify detects mismatch
  }

  scenario "Retention policy enforcement" {
    step critical = RecordAuditEntry({ actor_id: admin, action: ADMIN_OVERRIDE, resource_type: "Config", resource_id: c1, severity: CRITICAL, details: { override: true }, ip_address: "10.0.0.1" })

    # CRITICAL entries must use REGULATORY_7Y or PERMANENT retention
    step rule = RetentionRule.for(critical.result)
    assert rule.policy in [REGULATORY_7Y, PERMANENT]
  }
}
