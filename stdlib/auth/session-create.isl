# Session Management Module
# Provides secure session creation and management

module SessionCreate version "1.0.0"

# ============================================
# Types
# ============================================

type SessionId = UUID { immutable: true, unique: true }

type SessionToken = String { min_length: 64, max_length: 256, sensitive: true }

type DeviceFingerprint = String { max_length: 512 }

type SessionDuration = Duration { min: 1m, max: 30d }

# ============================================
# Entities
# ============================================

entity Session {
  id: SessionId [immutable, unique]
  user_id: UUID [immutable, indexed]
  token_hash: String [secret]
  created_at: Timestamp [immutable]
  expires_at: Timestamp [indexed]
  last_activity: Timestamp
  ip_address: String
  user_agent: String?
  device_fingerprint: DeviceFingerprint?
  revoked: Boolean [default: false]
  revoked_at: Timestamp?
  revoked_reason: String?

  invariants {
    expires_at > created_at
    revoked == true implies revoked_at != null
    last_activity >= created_at
    last_activity <= now()
  }
}

# ============================================
# Behaviors
# ============================================

behavior CreateSession {
  description: "Create a new authenticated session for a user"

  input {
    user_id: UUID
    ip_address: String
    user_agent: String?
    device_fingerprint: DeviceFingerprint?
    duration: SessionDuration [default: 24h]
    single_use: Boolean [default: false]
  }

  output {
    success: {
      session: Session
      token: SessionToken
    }

    errors {
      USER_NOT_FOUND {
        when: "User does not exist"
        retriable: false
      }
      USER_SUSPENDED {
        when: "User account is suspended"
        retriable: false
      }
      TOO_MANY_SESSIONS {
        when: "Maximum concurrent sessions exceeded"
        retriable: false
      }
    }
  }

  pre {
    User.exists(user_id)
    User.lookup(user_id).status == ACTIVE
  }

  post success {
    Session.exists(result.session.id)
    result.session.user_id == input.user_id
    result.session.expires_at == now() + input.duration
    result.session.ip_address == input.ip_address
    result.session.revoked == false
    result.token.length >= 64
  }

  invariants {
    token cryptographically random
    token_hash uses bcrypt or argon2
    token never stored in plaintext
  }

  temporal {
    within 200ms (p99): response returned
    eventually within 5s: session_created event emitted
  }

  security {
    rate_limit 50 per minute per user_id
  }
}

behavior ValidateSession {
  description: "Validate session token and return user info"

  input {
    token: SessionToken
    extend_on_activity: Boolean [default: true]
  }

  output {
    success: {
      session: Session
      user_id: UUID
    }

    errors {
      INVALID_TOKEN {
        when: "Token is invalid"
        retriable: false
      }
      SESSION_EXPIRED {
        when: "Session has expired"
        retriable: false
      }
      SESSION_REVOKED {
        when: "Session was revoked"
        retriable: false
      }
    }
  }

  pre {
    token.length >= 64
  }

  post success {
    result.session.revoked == false
    result.session.expires_at > now()
    input.extend_on_activity implies result.session.last_activity == now()
  }

  temporal {
    within 50ms (p50): response returned
    within 100ms (p99): response returned
  }
}

behavior RevokeSession {
  description: "Revoke an active session"

  input {
    session_id: SessionId
    reason: String?
  }

  output {
    success: Boolean

    errors {
      SESSION_NOT_FOUND {
        when: "Session does not exist"
        retriable: false
      }
      ALREADY_REVOKED {
        when: "Session already revoked"
        retriable: false
      }
    }
  }

  pre {
    Session.exists(session_id)
  }

  post success {
    Session.lookup(session_id).revoked == true
    Session.lookup(session_id).revoked_at == now()
    Session.lookup(session_id).revoked_reason == input.reason
  }

  temporal {
    immediately: session invalid for new requests
    eventually within 5s: session_revoked event emitted
  }
}

behavior RevokeAllUserSessions {
  description: "Revoke all sessions for a user"

  input {
    user_id: UUID
    except_session_id: SessionId?
    reason: String?
  }

  output {
    success: {
      revoked_count: Int
    }

    errors {
      USER_NOT_FOUND {
        when: "User does not exist"
        retriable: false
      }
    }
  }

  pre {
    User.exists(user_id)
  }

  post success {
    forall s in Session.where(user_id: user_id, revoked: false):
      s.id == input.except_session_id or s.revoked == true
  }

  temporal {
    within 1s (p99): response returned
    eventually within 10s: all caches invalidated
  }
}

behavior CleanupExpiredSessions {
  description: "Remove expired sessions from storage"

  input {
    older_than: Duration [default: 7d]
  }

  output {
    success: {
      deleted_count: Int
    }
  }

  pre {
    older_than >= 1d
  }

  post success {
    forall s in Session.where(expires_at < now() - input.older_than):
      not Session.exists(s.id)
  }

  temporal {
    within 30s (p99): operation completed
  }
}
