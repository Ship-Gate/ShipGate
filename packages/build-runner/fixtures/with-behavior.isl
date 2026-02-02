// ISL specification with multiple behaviors for testing
domain UserManagement {
  version: "2.0.0"
  
  entity User {
    id: UUID [immutable, unique]
    email: String [unique]
    name: String
    active: Boolean
    createdAt: Timestamp [immutable]
  }
  
  entity Session {
    id: UUID [immutable, unique]
    userId: UUID
    token: String
    expiresAt: Timestamp
  }
  
  behavior RegisterUser {
    description: "Registers a new user in the system"
    
    input {
      email: String
      name: String
      password: String
    }
    
    output {
      success: User
      
      errors {
        INVALID_EMAIL {
          when: "Email format is invalid"
          retriable: false
        }
        EMAIL_EXISTS {
          when: "Email already exists"
          retriable: false
        }
        WEAK_PASSWORD {
          when: "Password is too weak"
          retriable: true
        }
      }
    }
    
    preconditions {
      input.email.length > 0
      input.name.length > 0
      input.password.length >= 8
    }
    
    postconditions {
      success implies {
        result.email == input.email
        result.name == input.name
        result.active == true
      }
    }
  }
  
  behavior LoginUser {
    description: "Authenticates a user and creates a session"
    
    input {
      email: String
      password: String
    }
    
    output {
      success: Session
      
      errors {
        INVALID_CREDENTIALS {
          when: "Invalid email or password"
          retriable: false
        }
        ACCOUNT_DISABLED {
          when: "Account is disabled"
          retriable: false
        }
      }
    }
    
    preconditions {
      input.email.length > 0
      input.password.length > 0
    }
  }
  
  behavior DeactivateUser {
    description: "Deactivates a user account"
    
    input {
      userId: UUID
    }
    
    output {
      success: Boolean
      
      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
      }
    }
    
    preconditions {
      User.exists(input.userId)
    }
    
    postconditions {
      success implies {
        User.lookup(input.userId).active == false
      }
    }
  }
}
