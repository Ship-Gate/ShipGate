// Authentication: API key management
domain AuthAPIKeys {
  version: "1.0.0"

  enum APIKeyStatus {
    ACTIVE
    REVOKED
    EXPIRED
  }

  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    created_at: Timestamp [immutable]
  }

  entity APIKey {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    name: String
    key_hash: String [secret]
    key_prefix: String
    status: APIKeyStatus
    permissions: List<String>
    rate_limit: Int?
    expires_at: Timestamp?
    last_used_at: Timestamp?
    last_used_ip: String? [pii]
    created_at: Timestamp [immutable]

    invariants {
      name.length > 0
      key_prefix.length == 8
      rate_limit == null or rate_limit > 0
    }
  }

  entity APIKeyUsage {
    id: UUID [immutable, unique]
    api_key_id: UUID [indexed]
    endpoint: String
    method: String
    ip_address: String [pii]
    response_status: Int
    timestamp: Timestamp [immutable]
  }

  behavior CreateAPIKey {
    description: "Create a new API key"

    actors {
      User { must: authenticated }
    }

    input {
      name: String
      permissions: List<String>?
      rate_limit: Int?
      expires_in: Duration?
    }

    output {
      success: {
        api_key: APIKey
        key: String
      }

      errors {
        MAX_KEYS_REACHED {
          when: "Maximum number of API keys reached"
          retriable: false
        }
        INVALID_PERMISSIONS {
          when: "Requested permissions not allowed"
          retriable: false
        }
      }
    }

    pre {
      input.name.length > 0
      input.rate_limit == null or input.rate_limit > 0
      APIKey.count(user_id: actor.id, status: ACTIVE) < 10
    }

    post success {
      - APIKey.exists(result.api_key.id)
      - result.api_key.status == ACTIVE
      - result.api_key.user_id == actor.id
      - result.key starts with result.api_key.key_prefix
    }

    invariants {
      - key shown only once at creation
      - key stored as hash only
    }
  }

  behavior ValidateAPIKey {
    description: "Validate an API key for request"

    actors {
      System { }
    }

    input {
      key: String
    }

    output {
      success: {
        api_key: APIKey
        user: User
      }

      errors {
        INVALID_KEY {
          when: "API key is invalid"
          retriable: false
        }
        KEY_REVOKED {
          when: "API key has been revoked"
          retriable: false
        }
        KEY_EXPIRED {
          when: "API key has expired"
          retriable: false
        }
        RATE_LIMITED {
          when: "Rate limit exceeded"
          retriable: true
          retry_after: 1m
        }
      }
    }

    post success {
      - result.api_key.status == ACTIVE
      - result.api_key.expires_at == null or result.api_key.expires_at > now()
    }

    temporal {
      - within 5ms (p50): response returned
      - within 20ms (p99): response returned
    }
  }

  behavior RevokeAPIKey {
    description: "Revoke an API key"

    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      api_key_id: UUID
    }

    output {
      success: APIKey

      errors {
        KEY_NOT_FOUND {
          when: "API key does not exist"
          retriable: false
        }
        ALREADY_REVOKED {
          when: "API key is already revoked"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized to revoke this key"
          retriable: false
        }
      }
    }

    pre {
      APIKey.exists(input.api_key_id)
      APIKey.lookup(input.api_key_id).user_id == actor.id or actor.role == ADMIN
    }

    post success {
      - result.status == REVOKED
    }

    temporal {
      - immediately: key invalid for new requests
    }
  }

  behavior ListAPIKeys {
    description: "List user's API keys"

    actors {
      User { must: authenticated }
    }

    input {
      status_filter: APIKeyStatus?
    }

    output {
      success: List<APIKey>
    }

    post success {
      - all(k in result: k.user_id == actor.id)
      - input.status_filter != null implies all(k in result: k.status == input.status_filter)
    }
  }

  behavior GetAPIKeyUsage {
    description: "Get usage statistics for an API key"

    actors {
      User { must: authenticated }
    }

    input {
      api_key_id: UUID
      from: Timestamp?
      to: Timestamp?
    }

    output {
      success: {
        total_requests: Int
        usage_by_endpoint: Map<String, Int>
        usage_by_day: List<{ date: String, count: Int }>
      }

      errors {
        KEY_NOT_FOUND {
          when: "API key does not exist"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized to view usage"
          retriable: false
        }
      }
    }

    pre {
      APIKey.exists(input.api_key_id)
      APIKey.lookup(input.api_key_id).user_id == actor.id
    }
  }

  scenarios CreateAPIKey {
    scenario "create with defaults" {
      when {
        result = CreateAPIKey(name: "My API Key")
      }

      then {
        result is success
        result.api_key.name == "My API Key"
        result.api_key.status == ACTIVE
        result.key.length > 32
      }
    }

    scenario "create with expiration" {
      when {
        result = CreateAPIKey(
          name: "Temp Key",
          expires_in: 30.days
        )
      }

      then {
        result is success
        result.api_key.expires_at != null
      }
    }
  }
}
