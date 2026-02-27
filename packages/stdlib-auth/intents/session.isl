# Session Entity Specification
#
# Defines the Session entity for managing user authentication sessions.

domain Auth.Session {
  version: "0.1.0"

  # ============================================
  # Types
  # ============================================

  type SessionId = UUID { immutable: true, unique: true }
  type UserId = UUID { immutable: true }
  
  type IpAddress = String {
    pattern: "^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$"
  }

  type UserAgent = String {
    max_length: 500
  }

  type SessionToken = String {
    min_length: 64
    secret: true
  }

  # ============================================
  # Enums
  # ============================================

  enum SessionStatus {
    ACTIVE {
      description: "Session is valid and can be used"
    }
    EXPIRED {
      description: "Session has passed its expiration time"
    }
    REVOKED {
      description: "Session was explicitly invalidated"
    }
    SUPERSEDED {
      description: "Session was replaced by a newer session"
    }
  }

  enum RevocationReason {
    USER_LOGOUT {
      description: "User explicitly logged out"
    }
    PASSWORD_CHANGE {
      description: "Password was changed, invalidating all sessions"
    }
    SECURITY_CONCERN {
      description: "Session revoked due to security concerns"
    }
    ADMIN_ACTION {
      description: "Administrator revoked the session"
    }
    SESSION_LIMIT {
      description: "Maximum concurrent sessions exceeded"
    }
    EXPIRED {
      description: "Session expired naturally"
    }
  }

  # ============================================
  # Entity
  # ============================================

  entity Session {
    # Primary identifier
    id: SessionId [immutable, unique, indexed]
    
    # Session token for validation
    token: SessionToken [unique, secret, never_log]
    token_hash: String [indexed]
    
    # User reference
    user_id: UserId [immutable, indexed]
    
    # Status
    status: SessionStatus [indexed, default: ACTIVE]
    
    # Timestamps
    created_at: Timestamp [immutable]
    expires_at: Timestamp [indexed]
    last_activity_at: Timestamp
    revoked_at: Timestamp?
    
    # Revocation details
    revocation_reason: RevocationReason?
    
    # Client information
    ip_address: IpAddress
    user_agent: UserAgent?
    device_fingerprint: String?
    
    # Geolocation (optional)
    country_code: String? [max_length: 2]
    city: String? [max_length: 100]

    # ============================================
    # Invariants
    # ============================================

    invariants {
      # ID constraints
      id != null
      user_id != null
      
      # Token constraints
      token.length >= 64
      token_hash != null
      
      # Time constraints
      expires_at > created_at
      last_activity_at >= created_at
      last_activity_at <= now()
      
      # Status constraints
      status == REVOKED implies revoked_at != null
      status == REVOKED implies revocation_reason != null
      revoked_at != null implies revoked_at >= created_at
      
      # Expiration constraints
      status == EXPIRED implies expires_at <= now()
      status == ACTIVE implies (expires_at > now() and revoked_at == null)
      
      # IP address required
      ip_address != null
    }

    # ============================================
    # Lifecycle
    # ============================================

    lifecycle {
      initial: ACTIVE

      ACTIVE -> EXPIRED {
        when: expires_at <= now()
        automatic: true
      }
      
      ACTIVE -> REVOKED {
        when: explicit_revocation
        action: revoke_session
      }
      
      ACTIVE -> SUPERSEDED {
        when: session_limit_exceeded
        action: supersede_session
      }

      # Terminal states - no transitions out
      terminal: [EXPIRED, REVOKED, SUPERSEDED]
    }

    # ============================================
    # Computed Fields
    # ============================================

    computed {
      is_valid: Boolean = status == ACTIVE and expires_at > now()
      is_expired: Boolean = expires_at <= now()
      time_until_expiry: Duration? = is_valid ? (expires_at - now()) : null
      session_duration: Duration = now() - created_at
      idle_time: Duration = now() - last_activity_at
    }

    # ============================================
    # Indexes
    # ============================================

    indexes {
      primary: id
      unique: token_hash
      index: [user_id, status]
      index: [user_id, created_at]
      index: [expires_at]
      index: [ip_address, created_at]
    }
  }

  # ============================================
  # Session Queries
  # ============================================

  queries {
    find_by_id(id: SessionId): Session? {
      returns: Session.where(id == input.id).first
    }

    find_by_token_hash(token_hash: String): Session? {
      returns: Session.where(token_hash == input.token_hash).first
    }

    find_active_by_user(user_id: UserId): List<Session> {
      returns: Session
        .where(user_id == input.user_id)
        .where(status == ACTIVE)
        .where(expires_at > now())
        .order_by(created_at, desc)
        .all
    }

    find_all_by_user(user_id: UserId): List<Session> {
      returns: Session
        .where(user_id == input.user_id)
        .order_by(created_at, desc)
        .all
    }

    count_active_sessions(user_id: UserId): Int {
      returns: Session
        .where(user_id == input.user_id)
        .where(status == ACTIVE)
        .where(expires_at > now())
        .count
    }

    find_expired_sessions(): List<Session> {
      returns: Session
        .where(status == ACTIVE)
        .where(expires_at <= now())
        .all
    }
  }

  # ============================================
  # Session Commands
  # ============================================

  commands {
    create_session(
      user_id: UserId,
      ip_address: IpAddress,
      user_agent: UserAgent?,
      duration: Duration
    ): Session {
      preconditions {
        user_id != null
        ip_address != null
        duration > 0s
        duration <= 30d
      }
      
      postconditions {
        result.id != null
        result.token != null
        result.token.length >= 64
        result.user_id == input.user_id
        result.ip_address == input.ip_address
        result.status == ACTIVE
        result.created_at == now()
        result.expires_at == now() + input.duration
        result.last_activity_at == now()
      }
      
      invariants {
        - token is cryptographically secure random
        - token_hash computed using SHA-256
      }
    }

    revoke_session(
      session: Session,
      reason: RevocationReason
    ): Session {
      preconditions {
        session.status == ACTIVE
      }
      
      postconditions {
        result.status == REVOKED
        result.revoked_at == now()
        result.revocation_reason == input.reason
      }
    }

    extend_session(
      session: Session,
      additional_duration: Duration
    ): Session {
      preconditions {
        session.status == ACTIVE
        session.expires_at > now()
        additional_duration > 0s
        additional_duration <= 24h
      }
      
      postconditions {
        result.expires_at == old(session.expires_at) + input.additional_duration
        result.last_activity_at == now()
      }
    }

    update_activity(session: Session): Session {
      preconditions {
        session.status == ACTIVE
      }
      
      postconditions {
        result.last_activity_at == now()
      }
    }

    revoke_all_user_sessions(
      user_id: UserId,
      reason: RevocationReason,
      except_session_id: SessionId?
    ): Int {
      postconditions {
        all s in Session.where(user_id == input.user_id and status == ACTIVE):
          input.except_session_id == null or s.id != input.except_session_id
          implies s.status == REVOKED
        
        result == count of revoked sessions
      }
    }
  }

  # ============================================
  # Session Events
  # ============================================

  events {
    SessionCreated {
      session_id: SessionId
      user_id: UserId
      ip_address: IpAddress
      created_at: Timestamp
    }

    SessionRevoked {
      session_id: SessionId
      user_id: UserId
      reason: RevocationReason
      revoked_at: Timestamp
    }

    SessionExpired {
      session_id: SessionId
      user_id: UserId
      expired_at: Timestamp
    }

    SessionExtended {
      session_id: SessionId
      new_expires_at: Timestamp
    }
  }
}
