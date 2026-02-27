// Simple Test Spec - Used for MVP verification
// This spec uses the simpler parser-compatible format

domain SimpleAuth version "1.0.0"

entity User {
  id: UUID
  email: String
  password_hash: String
  isActive: Boolean
}

entity Session {
  id: UUID
  userId: UUID
  token: String
  expiresAt: Timestamp
}

behavior Login {
  input {
    email: String
    password: String
  }
  
  output {
    success: Session
  }
  
  preconditions {
    email != ""
    password.length >= 8
  }
  
  postconditions {
    success implies {
      result.expiresAt > now
    }
  }
}

behavior Logout {
  input {
    sessionId: UUID
  }
  
  output {
    success: Boolean
  }
  
  preconditions {
    sessionId != ""
  }
  
  postconditions {
    success implies {
      Session.find(sessionId) == null
    }
  }
}
