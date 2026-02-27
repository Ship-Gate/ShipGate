# API Key Management Domain
# Complete API key lifecycle with scopes and usage tracking

domain APIKeys {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type APIKey = String { prefix: "sk_", min_length: 32 }
  type APIKeyHash = String { length: 64 }
  type Scope = String { max_length: 100 }
  
  enum KeyStatus {
    ACTIVE
    EXPIRED
    REVOKED
  }
  
  enum KeyType {
    LIVE
    TEST
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity APIKeyRecord {
    id: UUID [immutable, unique]
    owner_id: UUID [indexed]
    key_hash: APIKeyHash [unique, indexed]
    key_prefix: String { length: 8 }  # First 8 chars for identification
    name: String { max_length: 255 }
    description: String?
    key_type: KeyType
    status: KeyStatus [default: ACTIVE]
    scopes: List<Scope>
    allowed_ips: List<String>?
    allowed_origins: List<String>?
    rate_limit: Int?
    last_used_at: Timestamp?
    last_used_ip: String?
    usage_count: Int [default: 0]
    expires_at: Timestamp?
    revoked_at: Timestamp?
    revoked_by: UUID?
    revocation_reason: String?
    metadata: Map<String, String>
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      key_prefix.length == 8
      revoked_at != null implies status == REVOKED
      expires_at != null implies expires_at > created_at
    }
    
    lifecycle {
      ACTIVE -> EXPIRED
      ACTIVE -> REVOKED
    }
  }
  
  entity APIKeyUsage {
    id: UUID [immutable, unique]
    key_id: UUID [indexed]
    timestamp: Timestamp [indexed]
    endpoint: String
    method: String
    status_code: Int
    ip_address: String
    user_agent: String?
    response_time_ms: Int
    
    invariants {
      status_code >= 100
      status_code < 600
      response_time_ms >= 0
    }
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior CreateAPIKey {
    description: "Create a new API key"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      name: String
      description: String?
      key_type: KeyType [default: LIVE]
      scopes: List<Scope>
      allowed_ips: List<String>?
      allowed_origins: List<String>?
      rate_limit: Int?
      expires_in_days: Int?
    }
    
    output {
      success: {
        key: APIKey  # Full key - only shown once!
        record: APIKeyRecord
      }
      
      errors {
        MAX_KEYS_EXCEEDED {
          when: "Maximum number of API keys reached"
          retriable: false
        }
        INVALID_SCOPE {
          when: "One or more scopes are invalid"
          retriable: false
        }
        INVALID_IP_FORMAT {
          when: "Invalid IP address format"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        APIKeyRecord.exists(result.record.id)
        result.record.status == ACTIVE
        result.key.starts_with("sk_")
      }
    }
    
    invariants {
      result.key displayed only once
      result.key generated with cryptographic randomness
      result.key stored only as hash
    }
    
    effects {
      AuditLog { log_key_created }
    }
  }
  
  behavior ValidateAPIKey {
    description: "Validate an API key and check permissions"
    
    actors {
      System { }
    }
    
    input {
      key: APIKey
      required_scope: Scope?
      ip_address: String?
      origin: String?
    }
    
    output {
      success: {
        valid: Boolean
        key_id: UUID
        owner_id: UUID
        scopes: List<Scope>
        key_type: KeyType
        rate_limit: Int?
      }
      
      errors {
        INVALID_KEY {
          when: "API key is invalid"
          retriable: false
        }
        KEY_EXPIRED {
          when: "API key has expired"
          retriable: false
        }
        KEY_REVOKED {
          when: "API key has been revoked"
          retriable: false
        }
        INSUFFICIENT_SCOPE {
          when: "API key does not have required scope"
          retriable: false
        }
        IP_NOT_ALLOWED {
          when: "Request IP is not in allowlist"
          retriable: false
        }
        ORIGIN_NOT_ALLOWED {
          when: "Request origin is not in allowlist"
          retriable: false
        }
        RATE_LIMITED {
          when: "API key rate limit exceeded"
          retriable: true
          retry_after: 60s
        }
      }
    }
    
    postconditions {
      success implies {
        APIKeyRecord.lookup(result.key_id).last_used_at == now()
        APIKeyRecord.lookup(result.key_id).usage_count == 
          old(APIKeyRecord.lookup(result.key_id).usage_count) + 1
      }
    }
    
    temporal {
      response within 10ms (p50)
      response within 50ms (p99)
    }
    
    security {
      timing_attack_resistant
    }
  }
  
  behavior ListAPIKeys {
    description: "List all API keys for the current user"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      status: KeyStatus?
      key_type: KeyType?
      limit: Int [default: 50]
      cursor: String?
    }
    
    output {
      success: {
        keys: List<APIKeyRecord>  # Without full key, only prefix
        next_cursor: String?
        total_count: Int
      }
    }
  }
  
  behavior UpdateAPIKey {
    description: "Update API key settings"
    
    actors {
      User { must: authenticated, owns: key }
    }
    
    input {
      key_id: UUID
      name: String?
      description: String?
      scopes: List<Scope>?
      allowed_ips: List<String>?
      allowed_origins: List<String>?
      rate_limit: Int?
    }
    
    output {
      success: APIKeyRecord
      
      errors {
        KEY_NOT_FOUND {
          when: "API key does not exist"
          retriable: false
        }
        KEY_NOT_ACTIVE {
          when: "Cannot update inactive key"
          retriable: false
        }
        INVALID_SCOPE {
          when: "One or more scopes are invalid"
          retriable: false
        }
      }
    }
    
    effects {
      AuditLog { log_key_updated }
    }
  }
  
  behavior RevokeAPIKey {
    description: "Revoke an API key"
    
    actors {
      User { must: authenticated, owns: key }
      Admin { must: authenticated }
    }
    
    input {
      key_id: UUID
      reason: String?
    }
    
    output {
      success: APIKeyRecord
      
      errors {
        KEY_NOT_FOUND {
          when: "API key does not exist"
          retriable: false
        }
        ALREADY_REVOKED {
          when: "API key is already revoked"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        APIKeyRecord.lookup(input.key_id).status == REVOKED
        APIKeyRecord.lookup(input.key_id).revoked_at == now()
      }
    }
    
    temporal {
      immediately: key invalid for all requests
    }
    
    effects {
      AuditLog { log_key_revoked }
    }
  }
  
  behavior RollAPIKey {
    description: "Generate new key while keeping settings"
    
    actors {
      User { must: authenticated, owns: key }
    }
    
    input {
      key_id: UUID
      keep_old_active_for: Int?  # seconds
    }
    
    output {
      success: {
        new_key: APIKey  # Full key - only shown once!
        new_record: APIKeyRecord
        old_record: APIKeyRecord
      }
      
      errors {
        KEY_NOT_FOUND {
          when: "API key does not exist"
          retriable: false
        }
        KEY_NOT_ACTIVE {
          when: "Cannot roll inactive key"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        APIKeyRecord.exists(result.new_record.id)
        result.new_record.scopes == result.old_record.scopes
        result.new_record.status == ACTIVE
        input.keep_old_active_for == null implies result.old_record.status == REVOKED
      }
    }
  }
  
  behavior GetKeyUsage {
    description: "Get usage statistics for an API key"
    
    actors {
      User { must: authenticated, owns: key }
    }
    
    input {
      key_id: UUID
      from_date: Timestamp?
      to_date: Timestamp?
      group_by: String?  # "hour", "day", "endpoint"
    }
    
    output {
      success: {
        total_requests: Int
        successful_requests: Int
        failed_requests: Int
        average_response_time_ms: Decimal
        requests_by_endpoint: Map<String, Int>?
        requests_over_time: List<{
          timestamp: Timestamp
          count: Int
        }>?
      }
    }
  }
  
  behavior RecordUsage {
    description: "Record API key usage (internal)"
    
    actors {
      System { }
    }
    
    input {
      key_id: UUID
      endpoint: String
      method: String
      status_code: Int
      ip_address: String
      user_agent: String?
      response_time_ms: Int
    }
    
    output {
      success: Boolean
    }
    
    temporal {
      response within 5ms
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios ValidateAPIKey {
    scenario "valid key with scope" {
      given {
        key_record = APIKeyRecord.create(
          owner_id: user.id,
          key_hash: hash("sk_test_abc123..."),
          status: ACTIVE,
          scopes: ["read:users", "write:users"]
        )
      }
      
      when {
        result = ValidateAPIKey(
          key: "sk_test_abc123...",
          required_scope: "read:users"
        )
      }
      
      then {
        result is success
        result.valid == true
        "read:users" in result.scopes
      }
    }
    
    scenario "key with IP restriction" {
      given {
        key_record = APIKeyRecord.create(
          status: ACTIVE,
          allowed_ips: ["192.168.1.0/24"]
        )
      }
      
      when {
        result = ValidateAPIKey(
          key: "sk_test_...",
          ip_address: "10.0.0.1"
        )
      }
      
      then {
        result is IP_NOT_ALLOWED
      }
    }
    
    scenario "expired key" {
      given {
        key_record = APIKeyRecord.create(
          status: ACTIVE,
          expires_at: now() - 1d
        )
      }
      
      when {
        result = ValidateAPIKey(key: "sk_test_...")
      }
      
      then {
        result is KEY_EXPIRED
      }
    }
  }
}
