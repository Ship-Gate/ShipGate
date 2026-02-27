domain Auth {
  version: "1.0.0"
  owner: "security-team"

  behavior Login {
    description: "Authenticate a user with email and password, returning a signed JWT"

    input {
      email: String
      password: String [sensitive]
    }

    output {
      success: {
        token: String
        expires_in: Int
      }
      errors {
        INVALID_CREDENTIALS {
          when: "Email not found OR password does not match"
          retriable: false
        }
        VALIDATION_ERROR {
          when: "Required fields are missing or empty"
          retriable: false
        }
        RATE_LIMITED {
          when: "Too many failed attempts from this IP"
          retriable: true
          retry_after: 60s
        }
      }
    }

    preconditions {
      input.email.length > 0
      input.password.length > 0
    }

    postconditions {
      success implies {
        result.token.length > 0
        result.expires_in == 3600
      }

      INVALID_CREDENTIALS implies {
        response.status == 401
        response.body.message == "Invalid credentials"
      }
    }

    invariants {
      // Passwords must never leak — not in logs, not in responses
      input.password never_appears_in logs
      input.password never_appears_in response

      // Prevent user enumeration: identical error for wrong email vs wrong password
      error_for("unknown email") == error_for("wrong password")
    }

    security {
      rate_limit 10 per minute per ip
    }

    temporal {
      within 500ms (p95): response returned
    }
  }

  scenarios Login {
    scenario "successful login with valid credentials" {
      given {
        user = User.create(
          email: "alice@example.com",
          password_hash: bcrypt("correct-password")
        )
      }
      when {
        result = Login(
          email: "alice@example.com",
          password: "correct-password"
        )
      }
      then {
        result is success
        result.token.length > 0
        result.expires_in == 3600
      }
    }

    scenario "wrong password returns generic error" {
      given {
        user = User.create(
          email: "alice@example.com",
          password_hash: bcrypt("correct-password")
        )
      }
      when {
        result = Login(
          email: "alice@example.com",
          password: "wrong-password"
        )
      }
      then {
        result is INVALID_CREDENTIALS
        result.message == "Invalid credentials"
      }
    }

    scenario "unknown email returns identical error" {
      when {
        result = Login(
          email: "nobody@example.com",
          password: "any-password"
        )
      }
      then {
        result is INVALID_CREDENTIALS
        result.message == "Invalid credentials"
      }
    }
  }
}
