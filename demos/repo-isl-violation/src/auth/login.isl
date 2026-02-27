# Authentication Login Spec
#
# Security contract: login endpoint must not leak whether
# an email address is registered. Attackers use divergent
# error messages for user enumeration attacks.

domain Auth version "1.0.0"

behavior Login {
  description: "Authenticate a user with email and password"

  input {
    email: Email
    password: String
  }

  output {
    success: {
      token: String
      user: { id: UUID, email: Email }
    }

    errors {
      InvalidCredentials {
        when: "email or password is incorrect"
      }
      ValidationError {
        when: "email or password format is invalid"
      }
      RateLimited {
        when: "too many login attempts"
      }
    }
  }

  # ─── Security Requirements ───

  # CRITICAL: return identical error for wrong email or wrong password.
  # Different messages let attackers enumerate valid accounts.
  invariant error_messages_identical {
    description: "return identical error for wrong email or password"
    rule: errors.InvalidCredentials.message == constant
    note: "Must not distinguish between unknown-email and wrong-password"
  }

  # Passwords must never appear in logs or responses
  invariant no_password_leak {
    description: "password must never be logged or returned in responses"
    rule: password.neverLogged() and password.neverReturned()
  }

  post InvalidCredentials {
    - response.error == "Invalid email or password"
    - response does not indicate which field was wrong
    - audit log records failed attempt
  }

  security {
    rate_limit: 5 per minute per ip
  }
}
