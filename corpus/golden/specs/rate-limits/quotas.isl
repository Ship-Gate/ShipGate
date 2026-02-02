// Rate Limits: Resource quotas
domain RateLimitsQuotas {
  version: "1.0.0"

  enum QuotaType {
    STORAGE
    API_CALLS
    BANDWIDTH
    SEATS
    PROJECTS
    RECORDS
    MESSAGES
  }

  enum QuotaPeriod {
    HOURLY
    DAILY
    MONTHLY
    YEARLY
    LIFETIME
  }

  entity QuotaDefinition {
    id: UUID [immutable, unique]
    plan_id: UUID [indexed]
    type: QuotaType
    limit: Int
    period: QuotaPeriod
    soft_limit: Int?
    overage_allowed: Boolean [default: false]
    overage_rate: Decimal?
    created_at: Timestamp [immutable]

    invariants {
      limit > 0
      soft_limit == null or soft_limit <= limit
      overage_allowed implies overage_rate != null
    }
  }

  entity QuotaUsage {
    id: UUID [immutable, unique]
    account_id: UUID [indexed]
    quota_definition_id: UUID [indexed]
    period_start: Timestamp
    period_end: Timestamp
    current_usage: Int
    peak_usage: Int
    overage: Int [default: 0]
    updated_at: Timestamp

    invariants {
      current_usage >= 0
      peak_usage >= current_usage
      overage >= 0
    }
  }

  behavior CheckQuota {
    description: "Check if quota allows operation"

    actors {
      System { }
    }

    input {
      account_id: UUID
      quota_type: QuotaType
      requested_amount: Int?
    }

    output {
      success: {
        allowed: Boolean
        current_usage: Int
        limit: Int
        remaining: Int
        overage_available: Int?
        period_ends: Timestamp
      }

      errors {
        ACCOUNT_NOT_FOUND {
          when: "Account not found"
          retriable: false
        }
        QUOTA_NOT_DEFINED {
          when: "No quota defined for type"
          retriable: false
        }
      }
    }

    pre {
      input.requested_amount == null or input.requested_amount > 0
    }

    post success {
      - result.remaining >= 0 or result.overage_available > 0
    }

    temporal {
      - within 10ms (p99): response returned
    }
  }

  behavior ConsumeQuota {
    description: "Consume quota amount"

    actors {
      System { }
    }

    input {
      account_id: UUID
      quota_type: QuotaType
      amount: Int
    }

    output {
      success: QuotaUsage

      errors {
        QUOTA_EXCEEDED {
          when: "Quota exceeded"
          retriable: false
        }
        OVERAGE_NOT_ALLOWED {
          when: "Overage not allowed"
          retriable: false
        }
      }
    }

    pre {
      input.amount > 0
    }

    post success {
      - result.current_usage >= input.amount
    }
  }

  behavior ReleaseQuota {
    description: "Release consumed quota"

    actors {
      System { }
    }

    input {
      account_id: UUID
      quota_type: QuotaType
      amount: Int
    }

    output {
      success: QuotaUsage
    }

    pre {
      input.amount > 0
    }

    post success {
      - result.current_usage >= 0
    }
  }

  behavior GetQuotaUsage {
    description: "Get quota usage summary"

    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      account_id: UUID?
    }

    output {
      success: List<{
        type: QuotaType
        limit: Int
        used: Int
        remaining: Int
        usage_percent: Decimal
        period: QuotaPeriod
        period_ends: Timestamp
        overage: Int
        overage_cost: Decimal?
      }>
    }
  }

  behavior SetQuotaOverride {
    description: "Override quota for account"

    actors {
      Admin { must: authenticated }
    }

    input {
      account_id: UUID
      quota_type: QuotaType
      new_limit: Int
      expires_at: Timestamp?
      reason: String?
    }

    output {
      success: QuotaDefinition

      errors {
        ACCOUNT_NOT_FOUND {
          when: "Account not found"
          retriable: false
        }
      }
    }

    pre {
      input.new_limit > 0
    }
  }

  behavior GetQuotaHistory {
    description: "Get historical quota usage"

    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      account_id: UUID?
      quota_type: QuotaType?
      from: Timestamp?
      to: Timestamp?
    }

    output {
      success: List<{
        period_start: Timestamp
        period_end: Timestamp
        type: QuotaType
        usage: Int
        limit: Int
        overage: Int
      }>
    }
  }

  scenarios CheckQuota {
    scenario "within quota" {
      given {
        quota = QuotaDefinition.create(type: STORAGE, limit: 1000, period: MONTHLY)
        usage = QuotaUsage.create(current_usage: 500)
      }

      when {
        result = CheckQuota(
          account_id: "acct-123",
          quota_type: STORAGE,
          requested_amount: 100
        )
      }

      then {
        result is success
        result.allowed == true
        result.remaining == 400
      }
    }

    scenario "quota exceeded" {
      given {
        quota = QuotaDefinition.create(type: API_CALLS, limit: 10000, period: DAILY)
        usage = QuotaUsage.create(current_usage: 10000)
      }

      when {
        result = CheckQuota(
          account_id: "acct-123",
          quota_type: API_CALLS
        )
      }

      then {
        result is success
        result.allowed == false
        result.remaining == 0
      }
    }
  }
}
