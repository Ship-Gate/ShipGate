# ============================================
# Core Primitive Patterns
# ============================================
#
# Reusable patterns and utilities for all ISL domains

# ============================================
# ENTITY PATTERNS
# ============================================

# Standard entity with ID and timestamps
pattern StandardEntity<Id = UUID> {
  id: Id [immutable, unique]
  created_at: Timestamp [immutable, auto_generated]
  updated_at: Timestamp [auto_generated]
  
  invariants {
    updated_at >= created_at
  }
}

# Soft-deletable entity
pattern SoftDeletable {
  deleted_at: Timestamp?
  deleted_by: UUID?
  
  derived {
    is_deleted: Boolean = deleted_at != null
    is_active: Boolean = deleted_at == null
  }
  
  behavior soft_delete(by: UUID?) {
    postconditions {
      deleted_at != null
      deleted_by == by
    }
  }
  
  behavior restore() {
    preconditions {
      is_deleted
    }
    postconditions {
      deleted_at == null
    }
  }
}

# Versioned entity (optimistic locking)
pattern Versioned {
  version: Int [auto_increment]
  
  invariants {
    version >= 1
  }
  
  behavior update_with_version(expected_version: Int) {
    preconditions {
      version == expected_version
    }
    postconditions {
      version == expected_version + 1
    }
    errors {
      CONCURRENT_MODIFICATION {
        when: version != expected_version
        fields { expected: Int, actual: Int }
      }
    }
  }
}

# Auditable entity
pattern Auditable {
  created_by: UUID?
  updated_by: UUID?
  
  audit_log: List<AuditEntry>? [transient]
}

type AuditEntry = {
  timestamp: Timestamp
  action: String
  actor: UUID?
  changes: Map<String, { old: Any?, new: Any? }>?
}

# ============================================
# STATE MACHINE PATTERN
# ============================================

pattern StateMachine<S: Enum> {
  status: S
  status_changed_at: Timestamp?
  status_history: List<StatusChange<S>>? [transient]
  
  behavior transition(to: S) {
    preconditions {
      transition_allowed(status, to)
    }
    postconditions {
      status == to
      status_changed_at == now()
    }
  }
}

type StatusChange<S> = {
  from: S
  to: S
  timestamp: Timestamp
  reason: String?
  actor: UUID?
}

# ============================================
# TREE PATTERN (Hierarchical Data)
# ============================================

pattern TreeNode<T> {
  parent_id: UUID?
  children_ids: List<UUID>?
  depth: Int [min: 0]
  path: String  # Materialized path: "/root/child/grandchild"
  
  derived {
    is_root: Boolean = parent_id == null
    is_leaf: Boolean = children_ids.is_empty
    has_children: Boolean = not is_leaf
  }
  
  invariants {
    is_root implies depth == 0
    not is_root implies depth > 0
    path.starts_with("/")
  }
  
  behavior add_child(child: T) {
    postconditions {
      children_ids.contains(child.id)
      child.parent_id == id
      child.depth == depth + 1
    }
  }
  
  behavior move_to(new_parent: T?) {
    postconditions {
      parent_id == new_parent?.id
      depth == (new_parent?.depth ?? -1) + 1
      path updated to reflect new position
    }
  }
}

# ============================================
# MONEY PATTERN
# ============================================

pattern Money {
  type Money = {
    amount: Decimal [precision: 2]
    currency: Currency
  }
  
  enum Currency {
    USD { symbol: "$", decimal_places: 2 }
    EUR { symbol: "€", decimal_places: 2 }
    GBP { symbol: "£", decimal_places: 2 }
    JPY { symbol: "¥", decimal_places: 0 }
    BTC { symbol: "₿", decimal_places: 8 }
    # ... more currencies
  }
  
  invariants {
    # Same currency for operations
    add(a: Money, b: Money) requires a.currency == b.currency
    subtract(a: Money, b: Money) requires a.currency == b.currency
  }
  
  behavior add(other: Money): Money {
    preconditions {
      currency == other.currency
    }
    postconditions {
      result.amount == amount + other.amount
      result.currency == currency
    }
  }
  
  behavior convert(to: Currency, rate: ExchangeRate): Money {
    postconditions {
      result.currency == to
      result.amount == amount * rate.rate
    }
  }
}

# ============================================
# ADDRESS PATTERN
# ============================================

type Address = {
  street_line_1: String
  street_line_2: String?
  city: String
  state: String?
  postal_code: String
  country: CountryCode
  
  # Geo
  latitude: Float?
  longitude: Float?
  
  # Metadata
  type: AddressType?
  verified: Boolean = false
  verified_at: Timestamp?
}

enum AddressType {
  RESIDENTIAL
  COMMERCIAL
  PO_BOX
  MILITARY
}

type CountryCode = String [pattern: "[A-Z]{2}"]  # ISO 3166-1 alpha-2

# ============================================
# CONTACT INFO PATTERN
# ============================================

type ContactInfo = {
  email: Email?
  phone: Phone?
  mobile: Phone?
  fax: Phone?
  
  preferred_method: ContactMethod?
  timezone: String?
  language: LanguageCode?
}

enum ContactMethod {
  EMAIL
  PHONE
  SMS
  MAIL
}

type LanguageCode = String [pattern: "[a-z]{2}(-[A-Z]{2})?"]  # BCP 47

# ============================================
# PAGINATION PATTERN
# ============================================

type PaginationRequest = {
  page: Int = 1 [min: 1]
  page_size: Int = 20 [min: 1, max: 100]
  
  # Cursor-based alternative
  cursor: String?
  
  # Sorting
  sort_by: String?
  sort_order: SortOrder = ASC
}

type PaginationResponse<T> = {
  items: List<T>
  
  # Offset pagination
  page: Int
  page_size: Int
  total_items: Int
  total_pages: Int
  
  # Cursor pagination
  next_cursor: String?
  prev_cursor: String?
  
  # Navigation
  has_next: Boolean
  has_previous: Boolean
}

enum SortOrder {
  ASC
  DESC
}

# ============================================
# ERROR PATTERN
# ============================================

type DomainError = {
  code: String
  message: String
  details: Map<String, Any>?
  
  # Tracing
  trace_id: String?
  timestamp: Timestamp
  
  # Nested errors
  cause: DomainError?
}

pattern ErrorCodes {
  # Standard error codes
  NOT_FOUND = "NOT_FOUND"
  ALREADY_EXISTS = "ALREADY_EXISTS"
  VALIDATION_ERROR = "VALIDATION_ERROR"
  UNAUTHORIZED = "UNAUTHORIZED"
  FORBIDDEN = "FORBIDDEN"
  CONFLICT = "CONFLICT"
  RATE_LIMITED = "RATE_LIMITED"
  INTERNAL_ERROR = "INTERNAL_ERROR"
}

# ============================================
# IDEMPOTENCY PATTERN
# ============================================

pattern Idempotent {
  idempotency_key: String? [unique_within_timeframe]
  
  behavior ensure_idempotent(key: String, ttl: Duration = 24.hours) {
    preconditions {
      # Check if key was used before
      not IdempotencyStore.exists(key) or IdempotencyStore.get(key).expired
    }
    
    effects {
      stores key with result
      expires after ttl
    }
  }
}

# ============================================
# RATE LIMITING PATTERN
# ============================================

pattern RateLimited {
  type RateLimit = {
    key: String
    limit: Int
    window: Duration
    remaining: Int
    reset_at: Timestamp
  }
  
  behavior check_rate_limit(key: String, limit: Int, window: Duration): Boolean {
    postconditions {
      result == true implies current_count < limit
      result == false implies current_count >= limit
    }
    
    errors {
      RATE_LIMIT_EXCEEDED {
        fields {
          limit: Int
          window: Duration
          retry_after: Duration
        }
      }
    }
  }
}

# ============================================
# WEBHOOK PATTERN
# ============================================

type WebhookConfig = {
  url: URL
  events: List<String>
  secret: String [secret]
  
  # Options
  active: Boolean = true
  retry_policy: RetryPolicy?
  
  # Auth
  headers: Map<String, String>?
}

type WebhookDelivery = {
  id: UUID
  webhook_id: UUID
  event: String
  payload: Any
  
  # Status
  status: DeliveryStatus
  attempts: Int
  last_attempt_at: Timestamp?
  
  # Response
  response_status: Int?
  response_body: String?
  response_time_ms: Int?
  
  # Error
  error: String?
}

enum DeliveryStatus {
  PENDING
  DELIVERING
  DELIVERED
  FAILED
}

type RetryPolicy = {
  max_attempts: Int
  initial_delay: Duration
  max_delay: Duration
  backoff_multiplier: Float
}
