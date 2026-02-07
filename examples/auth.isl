# User Authentication Domain
# Parser-compatible spec for Phase 3 verification
# Full auth.isl with extended syntax available in corpus/golden/specs/auth/

domain UserAuthentication {
  version: "1.0.0"

  enum UserStatus {
    ACTIVE
    INACTIVE
    LOCKED
    PENDING_VERIFICATION
  }

  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    password_hash: String [secret]
    status: UserStatus [indexed]
  }

  entity Session {
    id: UUID [immutable, unique]
    user_id: UUID [immutable, indexed]
    expires_at: Timestamp
    revoked: Boolean
    ip_address: String
  }

  behavior Login {
    input {
      email: String
      password: String [sensitive]
      ip_address: String
    }

    output {
      success: Session
      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
          retriable: true
        }
        USER_NOT_FOUND {
          when: "No user exists with this email"
          retriable: false
        }
        USER_LOCKED {
          when: "User account is locked"
          retriable: true
        }
        USER_INACTIVE {
          when: "User account is inactive"
          retriable: false
        }
      }
    }

    pre {
      email.is_valid
      password.length >= 8
    }

    post success {
      - Session.exists(result.id)
      - Session.user_id == User.lookup(email).id
      - Session.expires_at > now()
      - Session.ip_address == input.ip_address
    }

    invariants {
      - password never_logged
    }
  }

  behavior Logout {
    input {
      session_id: UUID
    }

    output {
      success: Boolean
      errors {
        SESSION_NOT_FOUND {
          when: "Session does not exist"
          retriable: false
        }
      }
    }

    pre {
      Session.exists(session_id)
    }

    post success {
      - Session.lookup(session_id).revoked == true
    }
  }

  behavior Register {
    input {
      email: String
      password: String [sensitive]
      confirm_password: String [sensitive]
    }

    output {
      success: User
      errors {
        EMAIL_ALREADY_EXISTS {
          when: "A user with this email already exists"
          retriable: false
        }
        PASSWORDS_DO_NOT_MATCH {
          when: "Password and confirmation do not match"
          retriable: true
        }
      }
    }

    pre {
      email.is_valid
      password.length >= 8
      password == confirm_password
    }

    post success {
      - User.exists(result.id)
      - User.email == input.email
      - User.password_hash != input.password
    }

    invariants {
      - password never_logged
    }
  }

  behavior ValidateSession {
    input {
      session_id: UUID
    }

    output {
      success: User
      errors {
        SESSION_NOT_FOUND {
          when: "Session does not exist"
          retriable: false
        }
        SESSION_EXPIRED {
          when: "Session has expired"
          retriable: false
        }
      }
    }

    pre {
      session_id.is_valid
    }

    post success {
      - Session.exists(session_id)
      - Session.revoked == false
      - Session.expires_at > now()
      - User.status == ACTIVE
    }
  }
}
