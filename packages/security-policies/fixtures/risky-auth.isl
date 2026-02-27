// RISKY: Authentication spec with security issues
// Used for testing security policy detection

domain RiskyAuth {
  version: "1.0.0"
  
  // Entity with PII that might be logged
  entity User {
    id: UUID [immutable]
    email: String  // Missing [pii] annotation
    phone: String  // Missing [pii] annotation
    password_hash: String  // Missing [secret] annotation
    ip_address: String  // PII without annotation
  }
  
  // RISKY: Login without rate limiting
  behavior Login {
    description: "Login without security"
    
    input {
      email: String
      password: String  // Missing [sensitive] annotation
    }
    
    output {
      success: {
        user_id: UUID
        token: String
      }
      
      errors {
        INVALID_CREDENTIALS {
          when: "Wrong email or password"
          retriable: true
        }
      }
    }
    
    preconditions {
      input.email.length > 0
      input.password.length > 0
    }
    
    // Missing: rate_limit
    // Missing: audit logging
    // Missing: password never_appears_in logs invariant
  }
  
  // RISKY: Register without rate limiting
  behavior Register {
    description: "User registration"
    
    input {
      email: String
      password: String  // Missing [sensitive]
      name: String
      phone: String  // PII without annotation
    }
    
    output {
      success: UUID
      
      errors {
        EMAIL_EXISTS { when: "Email taken" retriable: false }
      }
    }
    
    // Missing: rate_limit
    // Missing: password safety invariant
  }
  
  // RISKY: Password reset without rate limiting
  behavior ResetPassword {
    description: "Reset user password"
    
    input {
      token: String
      new_password: String  // Missing [sensitive]
    }
    
    output {
      success: Boolean
      
      errors {
        INVALID_TOKEN { when: "Token invalid" retriable: false }
      }
    }
    
    // Missing: rate_limit
    // Missing: invariant for new_password
  }
  
  // RISKY: Token refresh without auth requirement
  behavior RefreshToken {
    description: "Refresh access token"
    
    input {
      refresh_token: String  // Missing [secret]
    }
    
    output {
      success: {
        access_token: String
        refresh_token: String
      }
    }
    
    // Missing: requires authenticated
    // Missing: rate_limit
  }
}
