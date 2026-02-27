# Magic Link Authentication Domain
# Passwordless authentication via email magic links

domain MagicLink {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type MagicToken = String { min_length: 32, max_length: 64 }
  
  enum MagicLinkPurpose {
    LOGIN
    REGISTER
    VERIFY_EMAIL
    ACCOUNT_RECOVERY
  }
  
  enum MagicLinkStatus {
    PENDING
    USED
    EXPIRED
    REVOKED
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity MagicLinkToken {
    id: UUID [immutable, unique]
    token_hash: String [unique, indexed]
    email: String [indexed]
    user_id: UUID? [indexed]
    purpose: MagicLinkPurpose
    status: MagicLinkStatus [default: PENDING]
    ip_address: String?
    user_agent: String?
    redirect_url: String?
    metadata: Map<String, String>?
    expires_at: Timestamp
    used_at: Timestamp?
    created_at: Timestamp [immutable]
    
    invariants {
      expires_at > created_at
      used_at != null implies status == USED
    }
    
    lifecycle {
      PENDING -> USED
      PENDING -> EXPIRED
      PENDING -> REVOKED
    }
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior RequestMagicLink {
    description: "Request a magic link for authentication"
    
    actors {
      Anonymous { }
    }
    
    input {
      email: String { format: "email" }
      purpose: MagicLinkPurpose [default: LOGIN]
      redirect_url: String?
      metadata: Map<String, String>?
    }
    
    output {
      success: {
        message: String
        expires_in: Int
      }
      
      errors {
        RATE_LIMITED {
          when: "Too many requests"
          retriable: true
          retry_after: 60s
        }
        USER_NOT_FOUND {
          when: "No account with this email"
          retriable: false
          // Note: Don't reveal this in production for security
        }
      }
    }
    
    postconditions {
      success implies {
        MagicLinkToken.exists(email: input.email, status: PENDING)
      }
    }
    
    invariants {
      // Always return success message to prevent email enumeration
      response_time constant regardless of email existence
    }
    
    temporal {
      response within 500ms
      eventually within 2m: email_delivered
    }
    
    security {
      rate_limit 5 per hour per email
      rate_limit 20 per hour per ip
    }
    
    effects {
      Email { send_magic_link }
    }
  }
  
  behavior VerifyMagicLink {
    description: "Verify magic link and authenticate user"
    
    actors {
      Anonymous { }
    }
    
    input {
      token: MagicToken
      ip_address: String?
      user_agent: String?
    }
    
    output {
      success: {
        user_id: UUID
        session: Session
        access_token: String
        refresh_token: String?
        is_new_user: Boolean
        redirect_url: String?
      }
      
      errors {
        INVALID_TOKEN {
          when: "Token is invalid or not found"
          retriable: false
        }
        TOKEN_EXPIRED {
          when: "Token has expired"
          retriable: false
        }
        TOKEN_ALREADY_USED {
          when: "Token was already used"
          retriable: false
        }
        IP_MISMATCH {
          when: "Request IP doesn't match original"
          retriable: false
        }
      }
    }
    
    preconditions {
      MagicLinkToken.exists_by_hash(hash(input.token))
      MagicLinkToken.lookup_by_hash(hash(input.token)).status == PENDING
      MagicLinkToken.lookup_by_hash(hash(input.token)).expires_at > now()
    }
    
    postconditions {
      success implies {
        MagicLinkToken.lookup_by_hash(hash(input.token)).status == USED
        MagicLinkToken.lookup_by_hash(hash(input.token)).used_at == now()
        Session.exists(user_id: result.user_id)
      }
    }
    
    temporal {
      response within 500ms
    }
    
    effects {
      AuditLog { log_magic_link_used }
    }
  }
  
  behavior ResendMagicLink {
    description: "Resend a magic link email"
    
    actors {
      Anonymous { }
    }
    
    input {
      email: String { format: "email" }
      original_purpose: MagicLinkPurpose?
    }
    
    output {
      success: {
        message: String
        expires_in: Int
      }
      
      errors {
        TOO_SOON {
          when: "Please wait before requesting another link"
          retriable: true
          retry_after: 60s
        }
        RATE_LIMITED {
          when: "Too many requests"
          retriable: true
          retry_after: 5m
        }
      }
    }
    
    preconditions {
      // Previous link was sent more than 1 minute ago
      MagicLinkToken.latest(email: input.email).created_at < now() - 1m
    }
    
    postconditions {
      success implies {
        // Old pending tokens are revoked
        MagicLinkToken.old_pending(email: input.email).all(t => t.status == REVOKED)
      }
    }
  }
  
  behavior RevokeMagicLink {
    description: "Revoke a pending magic link"
    
    actors {
      System { }
      User { must: authenticated }
    }
    
    input {
      token_id: UUID?
      email: String?
      revoke_all: Boolean?
    }
    
    output {
      success: {
        revoked_count: Int
      }
    }
    
    postconditions {
      success implies {
        input.token_id != null implies 
          MagicLinkToken.lookup(input.token_id).status == REVOKED
        input.email != null and input.revoke_all implies
          MagicLinkToken.count(email: input.email, status: PENDING) == 0
      }
    }
  }
  
  behavior CheckTokenValidity {
    description: "Check if a magic link token is valid (for preview)"
    
    actors {
      Anonymous { }
    }
    
    input {
      token: MagicToken
    }
    
    output {
      success: {
        valid: Boolean
        purpose: MagicLinkPurpose?
        expires_in: Int?
        email_hint: String?  # e.g., "j***@example.com"
      }
    }
    
    temporal {
      response within 50ms
    }
  }
  
  behavior CleanupExpiredTokens {
    description: "Mark expired tokens and clean up"
    
    actors {
      System { }
    }
    
    output {
      success: {
        expired_count: Int
        deleted_count: Int
      }
    }
    
    temporal {
      runs every 1h
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios VerifyMagicLink {
    scenario "successful login" {
      given {
        user = User.create(email: "user@example.com")
        token = MagicLinkToken.create(
          email: "user@example.com",
          user_id: user.id,
          purpose: LOGIN,
          status: PENDING,
          expires_at: now() + 15m
        )
      }
      
      when {
        result = VerifyMagicLink(
          token: token.token,
          ip_address: "192.168.1.1"
        )
      }
      
      then {
        result is success
        result.user_id == user.id
        result.is_new_user == false
        Session.exists(user_id: user.id)
      }
    }
    
    scenario "new user registration" {
      given {
        token = MagicLinkToken.create(
          email: "newuser@example.com",
          user_id: null,
          purpose: REGISTER,
          status: PENDING
        )
      }
      
      when {
        result = VerifyMagicLink(token: token.token)
      }
      
      then {
        result is success
        result.is_new_user == true
        User.exists(email: "newuser@example.com")
      }
    }
    
    scenario "expired token" {
      given {
        token = MagicLinkToken.create(
          email: "user@example.com",
          expires_at: now() - 1h
        )
      }
      
      when {
        result = VerifyMagicLink(token: token.token)
      }
      
      then {
        result is TOKEN_EXPIRED
      }
    }
  }
}
