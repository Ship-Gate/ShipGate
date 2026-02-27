// Auth domain fixture: Registration behavior
domain Auth {
  version: "1.0.0"
  
  entity User {
    id: UUID [immutable]
    email: String [unique]
    password_hash: String [secret]
    status: String
    email_verified: Boolean
    created_at: Timestamp [immutable]
  }
  
  behavior Register {
    description: "Register a new user account"
    
    input {
      email: String
      password: String [sensitive]
      name: String?
    }
    
    output {
      success: User
      
      errors {
        EMAIL_EXISTS {
          when: "Email is already registered"
          retriable: false
        }
        INVALID_EMAIL {
          when: "Email format is invalid"
          retriable: false
        }
        WEAK_PASSWORD {
          when: "Password does not meet requirements"
          retriable: true
        }
      }
    }
    
    preconditions {
      input.email.length > 0
      input.password.length >= 8
      not User.exists(email: input.email)
    }
    
    postconditions {
      success implies {
        User.exists(result.id)
        User.lookup(result.id).email == input.email
        User.lookup(result.id).email_verified == false
      }
      
      EMAIL_EXISTS implies {
        User.count == old(User.count)
      }
    }
    
    invariants {
      input.password never_appears_in logs
      input.password never_appears_in result
    }
  }
}
