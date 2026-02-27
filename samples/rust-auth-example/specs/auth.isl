domain Auth {
  version "1.0.0"

  entity User {
    id: UUID @immutable @unique
    email: Email @unique
    username: String
    login_count: Integer @default(0)
    created_at: Timestamp @immutable
  }

  entity Session {
    id: UUID @immutable @unique
    user_id: UUID @immutable
    ip_address: String
    created_at: Timestamp @immutable
  }

  behavior CreateUser {
    input {
      email: Email
      username: String
    }
    output {
      success: User
      errors: [
        EMAIL_EXISTS: "Email already registered"
        INVALID_EMAIL: "Email format invalid"
      ]
    }
    preconditions {
      input.email.length > 0
      input.username.length > 0
    }
    postconditions {
      result.id != null
      result.email == input.email
    }
  }

  behavior Login {
    input {
      email: Email
      ip_address: String
    }
    output {
      success: Session
      errors: [
        USER_NOT_FOUND: "User does not exist"
        USER_LOCKED: "User account is locked"
      ]
    }
    preconditions {
      input.email.length > 0
    }
    postconditions {
      result.session_id != null
    }
  }
}
