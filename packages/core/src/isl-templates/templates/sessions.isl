# Session Management Domain
# Complete session management with device tracking and security

domain Sessions {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type SessionId = String { min_length: 32, max_length: 64 }
  type DeviceFingerprint = String { max_length: 255 }
  
  enum SessionStatus {
    ACTIVE
    EXPIRED
    REVOKED
    LOGGED_OUT
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity Session {
    id: UUID [immutable, unique]
    session_id: SessionId [unique, indexed]
    user_id: UUID [indexed]
    status: SessionStatus [default: ACTIVE]
    ip_address: String
    user_agent: String?
    device_fingerprint: DeviceFingerprint?
    device_name: String?
    device_type: String?
    browser: String?
    os: String?
    location: {
      country: String?
      region: String?
      city: String?
    }?
    is_current: Boolean [default: false]
    two_factor_verified: Boolean [default: false]
    last_activity_at: Timestamp
    expires_at: Timestamp
    created_at: Timestamp [immutable]
    revoked_at: Timestamp?
    revoked_reason: String?
    
    invariants {
      expires_at > created_at
      revoked_at != null implies status in [REVOKED, LOGGED_OUT]
    }
    
    lifecycle {
      ACTIVE -> EXPIRED
      ACTIVE -> REVOKED
      ACTIVE -> LOGGED_OUT
    }
  }
  
  entity SessionActivity {
    id: UUID [immutable, unique]
    session_id: UUID [indexed]
    action: String
    ip_address: String
    user_agent: String?
    metadata: Map<String, String>?
    created_at: Timestamp [immutable, indexed]
  }
  
  entity TrustedDevice {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    device_fingerprint: DeviceFingerprint [indexed]
    device_name: String
    device_type: String?
    trusted_at: Timestamp [immutable]
    last_used_at: Timestamp
    expires_at: Timestamp?
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior CreateSession {
    description: "Create a new session after authentication"
    
    actors {
      System { }
    }
    
    input {
      user_id: UUID
      ip_address: String
      user_agent: String?
      device_fingerprint: DeviceFingerprint?
      remember_me: Boolean [default: false]
    }
    
    output {
      success: {
        session: Session
        access_token: String
        refresh_token: String?
        requires_2fa: Boolean
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
        MAX_SESSIONS_EXCEEDED {
          when: "Maximum concurrent sessions reached"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        Session.exists(result.session.id)
        result.session.status == ACTIVE
      }
    }
    
    temporal {
      response within 200ms
    }
    
    effects {
      AuditLog { log_session_created }
    }
  }
  
  behavior ValidateSession {
    description: "Validate a session and update activity"
    
    actors {
      System { }
    }
    
    input {
      session_id: SessionId
      ip_address: String?
      user_agent: String?
    }
    
    output {
      success: {
        valid: Boolean
        session: Session
        user_id: UUID
      }
      
      errors {
        SESSION_NOT_FOUND {
          when: "Session does not exist"
          retriable: false
        }
        SESSION_EXPIRED {
          when: "Session has expired"
          retriable: false
        }
        SESSION_REVOKED {
          when: "Session has been revoked"
          retriable: false
        }
        IP_CHANGED {
          when: "Suspicious IP change detected"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        Session.lookup(input.session_id).last_activity_at == now()
      }
    }
    
    temporal {
      response within 20ms (p99)
    }
  }
  
  behavior RefreshSession {
    description: "Refresh session tokens"
    
    actors {
      System { }
    }
    
    input {
      refresh_token: String
    }
    
    output {
      success: {
        access_token: String
        refresh_token: String?
        expires_in: Int
      }
      
      errors {
        INVALID_TOKEN {
          when: "Refresh token is invalid"
          retriable: false
        }
        SESSION_EXPIRED {
          when: "Session has expired"
          retriable: false
        }
        TOKEN_REUSED {
          when: "Refresh token was already used (potential theft)"
          retriable: false
        }
      }
    }
    
    postconditions {
      TOKEN_REUSED implies {
        // Revoke all sessions for security
        Session.lookup_by_refresh(input.refresh_token).status == REVOKED
      }
    }
  }
  
  behavior EndSession {
    description: "Log out and end a session"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      session_id: UUID?  # If null, ends current session
    }
    
    output {
      success: Boolean
      
      errors {
        SESSION_NOT_FOUND {
          when: "Session does not exist"
          retriable: false
        }
        NOT_OWN_SESSION {
          when: "Cannot end another user's session"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        Session.lookup(session_id).status == LOGGED_OUT
      }
    }
    
    temporal {
      immediately: session invalidated
      eventually within 5s: caches cleared
    }
  }
  
  behavior RevokeAllSessions {
    description: "Revoke all user sessions (security measure)"
    
    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      user_id: UUID?
      except_current: Boolean [default: true]
      reason: String?
    }
    
    output {
      success: {
        revoked_count: Int
      }
    }
    
    postconditions {
      success implies {
        input.except_current implies 
          Session.count(user_id: target_user_id, status: ACTIVE) == 1
        not input.except_current implies
          Session.count(user_id: target_user_id, status: ACTIVE) == 0
      }
    }
    
    effects {
      Email { notify_sessions_revoked }
      AuditLog { log_sessions_revoked }
    }
  }
  
  behavior ListSessions {
    description: "List all active sessions for a user"
    
    actors {
      User { must: authenticated }
    }
    
    output {
      success: {
        sessions: List<Session>
        current_session_id: UUID
      }
    }
  }
  
  behavior TrustDevice {
    description: "Mark a device as trusted (skip 2FA)"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      device_fingerprint: DeviceFingerprint
      device_name: String
    }
    
    output {
      success: TrustedDevice
      
      errors {
        MAX_DEVICES {
          when: "Maximum trusted devices reached"
          retriable: false
        }
        ALREADY_TRUSTED {
          when: "Device is already trusted"
          retriable: false
        }
      }
    }
  }
  
  behavior UntrustDevice {
    description: "Remove a device from trusted list"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      device_id: UUID
    }
    
    output {
      success: Boolean
    }
    
    postconditions {
      success implies {
        not TrustedDevice.exists(input.device_id)
      }
    }
  }
  
  behavior DetectSuspiciousActivity {
    description: "Check for suspicious session patterns"
    
    actors {
      System { }
    }
    
    input {
      session_id: UUID
      ip_address: String
      user_agent: String?
    }
    
    output {
      success: {
        suspicious: Boolean
        reasons: List<String>?
        risk_score: Int
        recommended_action: String?
      }
    }
    
    temporal {
      response within 50ms
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios CreateSession {
    scenario "new session on trusted device" {
      given {
        trusted = TrustedDevice.create(
          user_id: user.id,
          device_fingerprint: "device-123"
        )
      }
      
      when {
        result = CreateSession(
          user_id: user.id,
          ip_address: "192.168.1.1",
          device_fingerprint: "device-123"
        )
      }
      
      then {
        result is success
        result.requires_2fa == false
      }
    }
    
    scenario "new session on unknown device" {
      given {
        config = User2FAConfig.create(
          user_id: user.id,
          status: ENABLED
        )
      }
      
      when {
        result = CreateSession(
          user_id: user.id,
          ip_address: "192.168.1.1",
          device_fingerprint: "new-device"
        )
      }
      
      then {
        result is success
        result.requires_2fa == true
        result.session.two_factor_verified == false
      }
    }
  }
}
