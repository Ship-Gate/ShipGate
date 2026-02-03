# Valid Authentication Spec
# Demonstrates:
# - Stdlib import for session management
# - Real postconditions that evaluator verifies
# - Proper intent decorators

domain ValidAuth version "1.0.0"

# Import stdlib session management
import { CreateSession, ValidateSession } from "@isl/stdlib/auth/session-create"

# ============================================
# Entities
# ============================================

entity User {
  id: UUID [immutable, unique]
  email: Email [unique, indexed]
  password_hash: String [secret]
  status: UserStatus
  login_count: Int [default: 0]
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  DELETED
}

entity Session {
  id: UUID [immutable, unique]
  user_id: UUID [immutable, indexed]
  token_hash: String [secret]
  created_at: Timestamp [immutable]
  expires_at: Timestamp [indexed]
}

# ============================================
# Behaviors with Real Postconditions
# ============================================

behavior Authenticate {
  description: "Authenticate user with email and password"
  
  @intent rate-limit-required
  @intent audit-required
  @intent no-pii-logging
  
  input {
    email: Email
    password: String
  }
  
  output {
    success: {
      session: Session
      user: User
    }
    errors {
      INVALID_CREDENTIALS {
        when: "Email or password is incorrect"
        retriable: false
      }
      ACCOUNT_SUSPENDED {
        when: "User account is suspended"
        retriable: false
      }
      RATE_LIMITED {
        when: "Too many authentication attempts"
        retriable: true
      }
    }
  }
  
  # Preconditions
  pre {
    input.email.length > 0
    input.password.length >= 8
  }
  
  # Real postconditions - evaluator verifies these
  post success {
    # Session was created for the authenticated user
    Session.exists(result.session.id)
    result.session.user_id == result.user.id
    
    # Session expires in the future
    result.session.expires_at > now()
    
    # User login count was incremented
    result.user.login_count > old(result.user.login_count)
  }
  
  post INVALID_CREDENTIALS {
    # No session created on failure
    not Session.exists({ user_id: input.user_id })
  }
  
  # Invariants
  invariants {
    # Password never appears in logs
    password.never_logged
    # Session token is cryptographically secure
    session.token_hash.is_hashed
  }
}

behavior GetUserProfile {
  description: "Get user profile by session token"
  
  @intent audit-required
  
  input {
    session_token: String
  }
  
  output {
    success: {
      user: User
    }
    errors {
      INVALID_SESSION {
        when: "Session token is invalid or expired"
        retriable: false
      }
    }
  }
  
  pre {
    input.session_token.length >= 32
  }
  
  # Postcondition: returned user matches session
  post success {
    User.exists(result.user.id)
    result.user.status == ACTIVE
  }
}
