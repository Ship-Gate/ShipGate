# JWT Token Management Domain
# Complete JWT handling with refresh tokens and blacklisting

domain JWTTokens {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type JWT = String { min_length: 100 }
  type JTI = String { length: 36 }  # JWT ID (UUID format)
  
  enum TokenType {
    ACCESS
    REFRESH
    ID
    API
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity TokenBlacklist {
    id: UUID [immutable, unique]
    jti: JTI [unique, indexed]
    token_type: TokenType
    user_id: UUID [indexed]
    reason: String?
    blacklisted_at: Timestamp [immutable, indexed]
    expires_at: Timestamp [indexed]  # Clean up after expiry
    
    invariants {
      expires_at > blacklisted_at
    }
  }
  
  entity RefreshTokenFamily {
    id: UUID [immutable, unique]
    family_id: String [unique, indexed]
    user_id: UUID [indexed]
    current_token_hash: String [indexed]
    generation: Int [default: 1]
    absolute_expires_at: Timestamp
    is_revoked: Boolean [default: false]
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      generation >= 1
      absolute_expires_at > created_at
    }
  }
  
  entity SigningKey {
    id: UUID [immutable, unique]
    key_id: String [unique, indexed]
    algorithm: String [values: ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"]]
    public_key: String
    private_key: String [secret]
    is_active: Boolean [default: true]
    activated_at: Timestamp?
    deactivated_at: Timestamp?
    created_at: Timestamp [immutable]
    
    invariants {
      deactivated_at != null implies is_active == false
    }
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior GenerateTokenPair {
    description: "Generate access and refresh token pair"
    
    actors {
      System { }
    }
    
    input {
      user_id: UUID
      session_id: UUID?
      scopes: List<String>?
      custom_claims: Map<String, Any>?
      access_token_ttl: Int? [default: 900]  # 15 minutes
      refresh_token_ttl: Int? [default: 604800]  # 7 days
    }
    
    output {
      success: {
        access_token: JWT
        refresh_token: JWT
        access_token_expires_at: Timestamp
        refresh_token_expires_at: Timestamp
        token_type: String
      }
      
      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        NO_ACTIVE_SIGNING_KEY {
          when: "No active signing key available"
          retriable: true
        }
      }
    }
    
    postconditions {
      success implies {
        RefreshTokenFamily.exists(user_id: input.user_id)
      }
    }
    
    invariants {
      access_token signed with active key
      refresh_token signed with active key
      tokens contain standard claims (iss, sub, aud, exp, iat, jti)
    }
  }
  
  behavior ValidateToken {
    description: "Validate a JWT and extract claims"
    
    actors {
      System { }
    }
    
    input {
      token: JWT
      expected_type: TokenType?
      required_scopes: List<String>?
      audience: String?
    }
    
    output {
      success: {
        valid: Boolean
        claims: {
          sub: String
          iss: String
          aud: String
          exp: Int
          iat: Int
          jti: JTI
          scopes: List<String>?
          custom: Map<String, Any>?
        }
        user_id: UUID
        remaining_ttl: Int
      }
      
      errors {
        INVALID_TOKEN {
          when: "Token signature is invalid"
          retriable: false
        }
        TOKEN_EXPIRED {
          when: "Token has expired"
          retriable: false
        }
        TOKEN_BLACKLISTED {
          when: "Token has been revoked"
          retriable: false
        }
        INVALID_AUDIENCE {
          when: "Token audience mismatch"
          retriable: false
        }
        INSUFFICIENT_SCOPE {
          when: "Token does not have required scopes"
          retriable: false
        }
        UNKNOWN_KEY {
          when: "Token signed with unknown key"
          retriable: false
        }
      }
    }
    
    preconditions {
      not TokenBlacklist.exists(jti: token.jti)
    }
    
    temporal {
      response within 5ms (p50)
      response within 20ms (p99)
    }
  }
  
  behavior RefreshTokens {
    description: "Use refresh token to get new token pair"
    
    actors {
      System { }
    }
    
    input {
      refresh_token: JWT
    }
    
    output {
      success: {
        access_token: JWT
        refresh_token: JWT
        access_token_expires_at: Timestamp
        refresh_token_expires_at: Timestamp
      }
      
      errors {
        INVALID_TOKEN {
          when: "Refresh token is invalid"
          retriable: false
        }
        TOKEN_EXPIRED {
          when: "Refresh token has expired"
          retriable: false
        }
        TOKEN_REUSED {
          when: "Refresh token was already used (token theft detected)"
          retriable: false
        }
        FAMILY_REVOKED {
          when: "Token family has been revoked"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        // Old refresh token invalidated
        TokenBlacklist.exists(jti: old_refresh_jti)
        // Family generation incremented
        RefreshTokenFamily.lookup(family_id).generation == 
          old(RefreshTokenFamily.lookup(family_id).generation) + 1
      }
      
      TOKEN_REUSED implies {
        // Entire family revoked (security breach)
        RefreshTokenFamily.lookup(family_id).is_revoked == true
      }
    }
  }
  
  behavior RevokeToken {
    description: "Revoke a specific token"
    
    actors {
      User { must: authenticated }
      System { }
    }
    
    input {
      token: JWT?
      jti: JTI?
      reason: String?
    }
    
    output {
      success: Boolean
      
      errors {
        TOKEN_NOT_FOUND {
          when: "Token or JTI not found"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        TokenBlacklist.exists(jti: input.jti or token.jti)
      }
    }
  }
  
  behavior RevokeAllUserTokens {
    description: "Revoke all tokens for a user"
    
    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      user_id: UUID
      reason: String?
    }
    
    output {
      success: {
        revoked_families: Int
      }
    }
    
    postconditions {
      success implies {
        RefreshTokenFamily.all(user_id: input.user_id).is_revoked == true
      }
    }
  }
  
  behavior RotateSigningKey {
    description: "Rotate to a new signing key"
    
    actors {
      Admin { must: authenticated }
      System { }
    }
    
    input {
      algorithm: String?
      deactivate_old_after: Int? [default: 86400]  # 24 hours
    }
    
    output {
      success: {
        new_key: SigningKey
        old_key_id: String?
        old_key_deactivates_at: Timestamp?
      }
    }
    
    postconditions {
      success implies {
        SigningKey.lookup(result.new_key.key_id).is_active == true
      }
    }
    
    effects {
      AuditLog { log_key_rotation }
    }
  }
  
  behavior GetJWKS {
    description: "Get JSON Web Key Set (public keys)"
    
    actors {
      Anonymous { }
    }
    
    output {
      success: {
        keys: List<{
          kty: String
          kid: String
          use: String
          alg: String
          n: String?  # RSA modulus
          e: String?  # RSA exponent
          x: String?  # EC x coordinate
          y: String?  # EC y coordinate
          crv: String?  # EC curve
        }>
      }
    }
    
    temporal {
      response within 50ms
      cacheable for 1h
    }
  }
  
  behavior CleanupExpiredBlacklist {
    description: "Remove expired entries from blacklist"
    
    actors {
      System { }
    }
    
    output {
      success: {
        removed_count: Int
      }
    }
    
    temporal {
      runs every 1h
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios RefreshTokens {
    scenario "successful refresh" {
      given {
        family = RefreshTokenFamily.create(
          user_id: user.id,
          generation: 1
        )
        tokens = GenerateTokenPair(user_id: user.id)
      }
      
      when {
        result = RefreshTokens(refresh_token: tokens.refresh_token)
      }
      
      then {
        result is success
        result.access_token != tokens.access_token
        RefreshTokenFamily.lookup(family.id).generation == 2
      }
    }
    
    scenario "token reuse attack detected" {
      given {
        // Attacker stole refresh token, victim already used it
        family = RefreshTokenFamily.create(
          user_id: user.id,
          generation: 2  // Already rotated once
        )
        old_refresh_token = "..."  // Generation 1 token
      }
      
      when {
        result = RefreshTokens(refresh_token: old_refresh_token)
      }
      
      then {
        result is TOKEN_REUSED
        // Entire family revoked
        RefreshTokenFamily.lookup(family.id).is_revoked == true
      }
    }
  }
}
