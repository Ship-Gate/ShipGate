# Authentication Behaviors
# Login, logout, session management

import { Auth } from "../domain.isl"

# ============================================
# Login
# ============================================

behavior Login {
  description: "Authenticate user with credentials"
  
  actors {
    User {
      for: credential_authentication
    }
  }
  
  input {
    email: Email?
    username: Username?
    password: Password
    mfa_code: String?
    device_info: DeviceInfo?
    remember_me: Boolean?
  }
  
  type DeviceInfo = {
    ip_address: String?
    user_agent: String?
    fingerprint: String?
  }
  
  output {
    success: {
      user: User
      session: Session
      access_token: String
      refresh_token: String?
      expires_in: Int
      requires_mfa: Boolean?
    }
    
    errors {
      INVALID_CREDENTIALS {
        when: "Email/username or password incorrect"
        retriable: true
        # Don't reveal which field was wrong
      }
      ACCOUNT_LOCKED {
        when: "Too many failed attempts"
        retriable: false
        data: { locked_until: Timestamp }
      }
      ACCOUNT_NOT_VERIFIED {
        when: "Email not verified"
        retriable: false
      }
      ACCOUNT_SUSPENDED {
        when: "Account suspended by admin"
        retriable: false
      }
      MFA_REQUIRED {
        when: "MFA enabled but code not provided"
        retriable: true
        data: { mfa_type: MFAType }
      }
      MFA_INVALID {
        when: "MFA code incorrect"
        retriable: true
      }
    }
  }
  
  preconditions {
    # Must provide email or username
    input.email != null or input.username != null
    
    # Password required
    input.password != null
    input.password.length >= 8
  }
  
  postconditions {
    success implies {
      - Session.exists(result.session.id)
      - result.session.user_id == result.user.id
      - result.session.expires_at > now()
      - result.user.last_login_at == now()
      - result.user.failed_login_attempts == 0
      - AuditLog.created(action: LOGIN, user_id: result.user.id)
    }
    
    INVALID_CREDENTIALS implies {
      - User(email: input.email).failed_login_attempts incremented
      - AuditLog.created(action: LOGIN_FAILED)
    }
  }
  
  temporal {
    - within 500.ms (p99): password verification
    - within 100.ms (p99): token generation
  }
  
  security {
    - rate_limit 5 per minute per IP
    - rate_limit 10 per minute per email
    - constant_time password comparison
  }
}

# ============================================
# Logout
# ============================================

behavior Logout {
  description: "End user session"
  
  actors {
    User {
      for: session_termination
    }
  }
  
  input {
    session_id: SessionId?
    all_sessions: Boolean?  # Logout from all devices
  }
  
  output {
    success: {
      sessions_revoked: Int
    }
    
    errors {
      SESSION_NOT_FOUND {
        when: "Session does not exist or already revoked"
      }
    }
  }
  
  preconditions {
    # Must be authenticated
    context.authenticated
    
    # Must specify target
    input.session_id != null or input.all_sessions == true
  }
  
  postconditions {
    success implies {
      - input.session_id != null implies {
          Session(input.session_id).revoked == true
        }
      - input.all_sessions implies {
          all Session where user_id == context.user.id : revoked == true
        }
      - AuditLog.created(action: LOGOUT)
    }
  }
}

# ============================================
# Refresh Token
# ============================================

behavior RefreshToken {
  description: "Exchange refresh token for new access token"
  
  input {
    refresh_token: String
  }
  
  output {
    success: {
      access_token: String
      refresh_token: String?  # Optional rotation
      expires_in: Int
    }
    
    errors {
      INVALID_TOKEN {
        when: "Token invalid or expired"
        retriable: false
      }
      SESSION_REVOKED {
        when: "Session has been revoked"
        retriable: false
      }
    }
  }
  
  preconditions {
    input.refresh_token != null
  }
  
  postconditions {
    success implies {
      - Session.last_activity_at updated
      - new access_token is valid
    }
  }
  
  security {
    - refresh_token_rotation: recommended
    - detect_token_reuse: revoke_all_sessions
  }
}

# ============================================
# Verify Session
# ============================================

behavior VerifySession {
  description: "Validate session and return user"
  
  input {
    access_token: String
  }
  
  output {
    success: {
      user: User
      session: Session
      permissions: Set<Permission>
    }
    
    errors {
      INVALID_TOKEN {
        when: "Token invalid, expired, or malformed"
      }
      SESSION_EXPIRED {
        when: "Session has expired"
      }
      SESSION_REVOKED {
        when: "Session has been revoked"
      }
      USER_SUSPENDED {
        when: "User account is suspended"
      }
    }
  }
  
  preconditions {
    input.access_token != null
  }
  
  postconditions {
    success implies {
      - Session.last_activity_at updated
      - result.user.status == ACTIVE
    }
  }
  
  temporal {
    - within 10.ms (p99): token validation
    - within 50.ms (p99): permission lookup
  }
}

# ============================================
# Scenarios
# ============================================

scenarios Login {
  scenario "successful login" {
    given {
      User exists with email "user@example.com"
      User.password_hash matches "correct_password"
      User.status == ACTIVE
      User.email_verified == true
    }
    
    when {
      result = Login(
        email: "user@example.com",
        password: "correct_password"
      )
    }
    
    then {
      result is success
      result.access_token != null
      result.user.email == "user@example.com"
    }
  }
  
  scenario "login with MFA" {
    given {
      User exists with mfa_enabled == true
    }
    
    when {
      result = Login(
        email: "user@example.com",
        password: "correct_password"
      )
    }
    
    then {
      result is error MFA_REQUIRED
      result.error.data.mfa_type != null
    }
  }
  
  scenario "account lockout after failures" {
    given {
      User exists with failed_login_attempts == 4
    }
    
    when {
      result = Login(
        email: "user@example.com",
        password: "wrong_password"
      )
    }
    
    then {
      result is error ACCOUNT_LOCKED
      User.failed_login_attempts == 5
      User.locked_until != null
    }
  }
}
