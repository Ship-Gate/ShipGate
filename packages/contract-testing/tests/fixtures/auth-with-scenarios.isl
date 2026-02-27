domain UserAuthentication {
  version: "1.0.0"

  enum UserStatus {
    ACTIVE
    INACTIVE
    LOCKED
  }

  entity User {
    id: UUID
    email: String
    password_hash: String
    status: UserStatus
  }

  entity Session {
    id: UUID
    user_id: UUID
    expires_at: Timestamp
    revoked: Boolean
    ip_address: String
  }

  behavior Login {
    input {
      email: String
      password: String
      ip_address: String
    }

    output {
      success: Session
      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
        }
        USER_NOT_FOUND {
          when: "No user exists with this email"
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
    }
  }

  scenarios Login {
    scenario "successful login" {
      given {
        email = "alice@example.com"
        password = "password123"
        ip_address = "192.168.1.1"
      }
      when {
        result = Login(email: email, password: password, ip_address: ip_address)
      }
      then {
        result is success
        result.id != null
        result.user_id != null
      }
    }

    scenario "invalid credentials" {
      given {
        email = "alice@example.com"
        password = "wrongpassword"
      }
      when {
        result = Login(email: email, password: password, ip_address: "192.168.1.1")
      }
      then {
        result is failure
        result.error == INVALID_CREDENTIALS
      }
    }
  }

  behavior Register {
    input {
      email: String
      password: String
      confirm_password: String
    }

    output {
      success: User
      errors {
        EMAIL_ALREADY_EXISTS {
          when: "A user with this email already exists"
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
    }
  }

  scenarios Register {
    scenario "successful registration" {
      given {
        email = "newuser@example.com"
        password = "password123"
        confirm_password = "password123"
      }
      when {
        result = Register(email: email, password: password, confirm_password: confirm_password)
      }
      then {
        result is success
        result.email == email
      }
    }
  }
}
