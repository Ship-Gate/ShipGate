// Auth domain fixture: Login behavior
domain Auth {
  version: "1.0.0"
  
  entity User {
    id: UUID [immutable]
    email: String [unique]
    password_hash: String [secret]
    status: String
    failed_login_attempts: Int
    mfa_enabled: Boolean
    last_login: Timestamp?
  }
  
  entity Session {
    id: UUID [immutable]
    user_id: UUID
    token_hash: String [secret]
    expires_at: Timestamp
    revoked: Boolean
  }
  
  behavior Login {
    description: "Authenticate user with email and password"
    
    input {
      email: String
      password: String [sensitive]
    }
    
    output {
      success: {
        session: Session
        access_token: String
        requires_mfa: Boolean
      }
      
      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
          retriable: true
        }
        ACCOUNT_LOCKED {
          when: "Account is locked after failed attempts"
          retriable: true
        }
      }
    }
    
    preconditions {
      input.email.length > 0
      input.password.length > 0
    }
    
    postconditions {
      success implies {
        Session.exists(result.session.id)
        result.access_token != null
        User.lookup(input.email).failed_login_attempts == 0
      }
      
      INVALID_CREDENTIALS implies {
        User.exists(email: input.email) implies {
          User.lookup(input.email).failed_login_attempts == old(User.lookup(input.email).failed_login_attempts) + 1
        }
      }
    }
    
    invariants {
      input.password never_appears_in logs
    }
  }
}
