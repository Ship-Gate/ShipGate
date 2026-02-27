# AI-proposed spec WITH strong postconditions and invariants
# Property-based tests can confirm these hold → score increases

domain TokenService {
  version: "1.0.0"

  entity Token {
    id: UUID [immutable, unique]
    value: String
    expires_at: Timestamp
    revoked: Boolean
  }

  behavior GenerateToken {
    input {
      user_id: UUID
      ttl_seconds: Int
    }

    output {
      success: Token
      errors {
        INVALID_TTL {
          when: "TTL must be positive"
          retriable: false
        }
      }
    }

    preconditions {
      - input.ttl_seconds > 0
    }

    postconditions {
      success implies {
        - result.id.length > 0
        - result.value.length >= 32
        - result.revoked == false
      }
    }

    invariants {
      - token_value_is_unique
      - token_not_expired_on_creation
    }
  }

  behavior RevokeToken {
    input {
      token_id: UUID
    }

    output {
      success: Boolean
      errors {
        TOKEN_NOT_FOUND {
          when: "Token does not exist"
          retriable: false
        }
      }
    }

    postconditions {
      success implies {
        - result == true
      }
    }
  }
}
