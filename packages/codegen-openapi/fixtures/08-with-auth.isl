// Domain with authentication entities
domain Authentication {
  version: "1.0.0"
  
  enum SessionStatus {
    ACTIVE
    EXPIRED
    REVOKED
  }
  
  entity User {
    id: UUID [immutable]
    email: String [unique]
    password_hash: String [secret]
    name: String
    roles: List<String>
    last_login: Timestamp?
    created_at: Timestamp [immutable]
  }
  
  entity Session {
    id: UUID [immutable]
    user_id: UUID [indexed]
    token_hash: String [secret]
    status: SessionStatus
    ip_address: String
    user_agent: String
    expires_at: Timestamp
    created_at: Timestamp [immutable]
  }
  
  behavior RegisterUser {
    description: "Register a new user"
    input {
      email: String
      password: String [sensitive]
      name: String
    }
    output {
      success: User
      errors {
        EMAIL_EXISTS {
          when: "Email already registered"
        }
        WEAK_PASSWORD {
          when: "Password does not meet requirements"
        }
      }
    }
  }
  
  behavior LoginUser {
    description: "Authenticate user"
    input {
      email: String
      password: String [sensitive]
    }
    output {
      success: Session
      errors {
        INVALID_CREDENTIALS {
          when: "Email or password incorrect"
        }
        ACCOUNT_LOCKED {
          when: "Account is locked"
        }
      }
    }
  }
  
  behavior LogoutUser {
    description: "End user session"
    input {
      session_id: UUID
    }
    output {
      success: Boolean
      errors {
        SESSION_NOT_FOUND {
          when: "Session does not exist"
        }
      }
    }
  }
}
