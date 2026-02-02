// SAFE: Authentication spec with proper security
// Used for testing that compliant specs pass

domain SafeAuth {
  version: "1.0.0"
  
  // Entity with proper annotations
  entity User {
    id: UUID [immutable, unique]
    email: String [pii, indexed]
    phone: String? [pii]
    password_hash: String [secret]
    ip_address: String? [pii]
    
    created_at: Timestamp [immutable]
  }
  
  entity AuditLog {
    id: UUID [immutable]
    user_id: UUID?
    action: String
    timestamp: Timestamp [immutable]
  }
  
  // SAFE: Login with all security requirements
  behavior Login {
    description: "Secure login"
    
    input {
      email: String
      password: String [sensitive]
      device_info: String?
    }
    
    output {
      success: {
        user_id: UUID
        access_token: String
      }
      
      errors {
        INVALID_CREDENTIALS {
          when: "Wrong email or password"
          retriable: true
        }
        ACCOUNT_LOCKED {
          when: "Too many failed attempts"
          retriable: true
          retry_after: 15.minutes
        }
        RATE_LIMITED {
          when: "Too many requests"
          retriable: true
          retry_after: 5.minutes
        }
      }
    }
    
    preconditions {
      input.email.length > 0
      input.password.length >= 8
    }
    
    postconditions {
      success implies {
        AuditLog.exists(action: "LOGIN")
      }
    }
    
    invariants {
      input.password never_appears_in logs
      input.password never_appears_in result
    }
    
    security {
      rate_limit 5 per ip_address
    }
    
    observability {
      logs {
        exclude: [password, email]
      }
    }
  }
  
  // SAFE: Register with proper security
  behavior Register {
    description: "Secure registration"
    
    input {
      email: String [pii]
      password: String [sensitive]
      name: String?
    }
    
    output {
      success: UUID
      
      errors {
        EMAIL_EXISTS { when: "Email taken" retriable: false }
        WEAK_PASSWORD { when: "Password too weak" retriable: true }
        RATE_LIMITED { when: "Too many attempts" retriable: true retry_after: 5.minutes }
      }
    }
    
    preconditions {
      input.email.length > 0
      input.password.length >= 8
    }
    
    postconditions {
      success implies {
        AuditLog.exists(action: "REGISTER")
      }
    }
    
    invariants {
      input.password never_appears_in logs
      input.password never_appears_in result
    }
    
    security {
      rate_limit 3 per ip_address
    }
    
    observability {
      logs {
        exclude: [password, email]
      }
    }
  }
  
  // SAFE: Session management with auth
  behavior Logout {
    description: "Secure logout"
    
    input {
      session_id: UUID
    }
    
    output {
      success: Boolean
    }
    
    postconditions {
      success implies {
        AuditLog.exists(action: "LOGOUT")
      }
    }
    
    security {
      requires authenticated
      rate_limit 10 per user_id
    }
  }
}
