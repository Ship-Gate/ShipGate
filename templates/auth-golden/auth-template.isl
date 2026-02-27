# Golden Auth Template — ISL Specification
# Hand-crafted, verified, production-quality auth implementation
# Stack: Next.js App Router, Prisma, TypeScript, Zod, bcrypt, jose (JWT)

domain AuthGolden {
  version: "1.0.0"
  owner: "IntentOS Golden Templates"

  # ─── TYPES ───────────────────────────────────────────────────────────────────

  enum Role {
    USER
    ADMIN
  }

  # ─── ENTITIES ─────────────────────────────────────────────────────────────────

  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    password_hash: String [secret]
    name: String
    role: Role [default: USER, indexed]
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      email.contains("@")
      name.length > 0
    }
  }

  entity RefreshToken {
    id: UUID [immutable, unique]
    token_hash: String [secret, unique]
    user_id: UUID [indexed]
    expires_at: Timestamp
    created_at: Timestamp [immutable]

    invariants {
      expires_at > created_at
    }
  }

  # ─── BEHAVIORS ────────────────────────────────────────────────────────────────

  behavior Register {
    description: "Register a new user with email/password"

    input {
      email: String
      password: String [sensitive]
      name: String
      role: Role? [default: USER]
    }

    output {
      success: User
      errors {
        EMAIL_TAKEN {
          when: "Email address is already registered"
          retriable: false
        }
        WEAK_PASSWORD {
          when: "Password does not meet strength requirements"
          retriable: true
        }
      }
    }

    pre {
      email.is_valid
      password.length >= 8
      password contains uppercase
      password contains lowercase
      password contains digit
      name.length > 0
      not User.exists_by_email(email)
    }

    post success {
      User.exists(result.id)
      result.email == input.email
      result.password_hash != input.password
      result.role == input.role or USER
      RefreshToken.exists_for_user(result.id)
    }

    invariants {
      password never_logged
      password_hash uses bcrypt cost 12
    }
  }

  behavior Login {
    description: "Authenticate user and issue JWT pair"

    input {
      email: String
      password: String [sensitive]
    }

    output {
      success: {
        user: User
        access_token_expires_at: Timestamp
        refresh_token_expires_at: Timestamp
      }
      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
          retriable: true
        }
      }
    }

    pre {
      email.is_valid
      password.length >= 1
    }

    post success {
      User.exists(result.user.id)
      result.user.email == input.email
      RefreshToken.exists_for_user(result.user.id)
      access_token_ttl == 900
      refresh_token_ttl == 604800
    }

    invariants {
      password never_logged
      tokens in httpOnly cookies
    }
  }

  behavior Logout {
    description: "Invalidate refresh token and clear cookies"

    input {
      refresh_token: String? [from cookie]
    }

    output {
      success: Boolean
    }

    post success {
      not RefreshToken.exists_for_token(input.refresh_token)
    }
  }

  behavior Refresh {
    description: "Rotate refresh token, issue new access/refresh pair"

    input {
      refresh_token: String [from cookie]
    }

    output {
      success: {
        user: User
        access_token_expires_at: Timestamp
        refresh_token_expires_at: Timestamp
      }
      errors {
        INVALID_TOKEN {
          when: "Refresh token is invalid or expired"
          retriable: false
        }
        TOKEN_REVOKED {
          when: "Refresh token was already used (rotation)"
          retriable: false
        }
      }
    }

    post success {
      not RefreshToken.exists_for_token(input.refresh_token)
      RefreshToken.exists_for_user(result.user.id)
    }

    invariants {
      old refresh token invalidated
      token rotation on every refresh
    }
  }

  # ─── API ──────────────────────────────────────────────────────────────────────

  api {
    base: "/api/auth"

    POST "/register" -> Register {
      body: Register
      response: User
      cookies: [access_token, refresh_token]
    }

    POST "/login" -> Login {
      body: Login
      response: User
      cookies: [access_token, refresh_token]
    }

    POST "/logout" -> Logout {
      response: Boolean
      clears: [access_token, refresh_token]
    }

    POST "/refresh" -> Refresh {
      cookies: [refresh_token]
      response: User
      cookies: [access_token, refresh_token]
    }
  }

  # ─── SECURITY (FIXED) ──────────────────────────────────────────────────────────

  security {
    access_token_ttl: 900
    refresh_token_ttl: 604800
    bcrypt_cost: 12
    http_only_cookies: true
    same_site: lax
    secure_in_production: true
  }

  # ─── SCENARIOS ────────────────────────────────────────────────────────────────

  scenario "Register and login flow" {
    given {
      User.count == 0
    }
    when {
      reg = Register(email: "test@example.com", password: "SecurePass123!", name: "Test User")
      login = Login(email: "test@example.com", password: "SecurePass123!")
    }
    then {
      reg is success
      login is success
      login.result.user.id == reg.result.id
    }
  }

  scenario "Duplicate email rejected" {
    given {
      reg = Register(email: "dup@example.com", password: "SecurePass123!", name: "First")
    }
    when {
      dup = Register(email: "dup@example.com", password: "OtherPass456!", name: "Second")
    }
    then {
      dup.error == EMAIL_TAKEN
    }
  }

  scenario "Invalid credentials" {
    given {
      reg = Register(email: "auth@example.com", password: "SecurePass123!", name: "Auth User")
    }
    when {
      fail = Login(email: "auth@example.com", password: "WrongPassword")
    }
    then {
      fail.error == INVALID_CREDENTIALS
    }
  }
}
