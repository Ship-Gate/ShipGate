# Login Behavior Specification
#
# User authentication with session creation.

domain Auth.Behaviors {
  version: "0.1.0"

  import { User, UserStatus, UserId } from "../user.isl"
  import { Session, SessionId, SessionStatus } from "../session.isl"

  # ============================================
  # Login Behavior
  # ============================================

  behavior Login {
    description: "Authenticate a user with email and password, creating a new session"

    # ============================================
    # Actors
    # ============================================

    actors {
      Anonymous {
        for: authentication
        constraints {
          not currently_authenticated
        }
      }
    }

    # ============================================
    # Input
    # ============================================

    input {
      email: String [format: "email"]
      password: String [sensitive, never_log]
      ip_address: String
      user_agent: String?
      remember_me: Boolean [default: false]
      device_fingerprint: String?
    }

    # ============================================
    # Output
    # ============================================

    output {
      success: {
        session: Session
        user: User { fields: [id, email, display_name, roles] }
        token: String [sensitive]
        expires_at: Timestamp
      }

      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
          retriable: true
          retry_after: 1s
          http_status: 401
        }
        USER_NOT_FOUND {
          when: "No user exists with this email"
          retriable: false
          http_status: 401
          # Return same error as INVALID_CREDENTIALS to prevent enumeration
          alias: INVALID_CREDENTIALS
        }
        USER_LOCKED {
          when: "User account is locked due to too many failed attempts"
          retriable: true
          retry_after: 15m
          http_status: 423
          returns: {
            locked_until: Timestamp?
            can_reset_password: Boolean
          }
        }
        USER_INACTIVE {
          when: "User account is inactive or deactivated"
          retriable: false
          http_status: 403
        }
        USER_SUSPENDED {
          when: "User account has been suspended"
          retriable: false
          http_status: 403
          returns: {
            reason: String?
            contact_support: Boolean
          }
        }
        EMAIL_NOT_VERIFIED {
          when: "User email has not been verified"
          retriable: false
          http_status: 403
          returns: {
            can_resend_verification: Boolean
          }
        }
        SESSION_LIMIT_EXCEEDED {
          when: "Maximum concurrent sessions reached"
          retriable: true
          http_status: 429
          returns: {
            active_sessions: Int
            max_sessions: Int
          }
        }
      }
    }

    # ============================================
    # Preconditions
    # ============================================

    preconditions {
      # Input validation
      input.email.is_valid_format
      input.password.length >= 8
      input.password.length <= 128
      input.ip_address != null
    }

    # ============================================
    # Postconditions
    # ============================================

    postconditions {
      success implies {
        # Session created
        - Session.exists(result.session.id)
        - result.session.user_id == result.user.id
        - result.session.status == ACTIVE
        - result.session.ip_address == input.ip_address
        - result.session.user_agent == input.user_agent
        - result.session.created_at == now()
        
        # Session expiration based on remember_me
        - input.remember_me == true implies result.session.expires_at == now() + 30d
        - input.remember_me == false implies result.session.expires_at == now() + 24h
        - result.expires_at == result.session.expires_at
        
        # Token generated
        - result.token != null
        - result.token.length >= 64
        
        # User state updated
        - User.lookup(result.user.id).last_login == now()
        - User.lookup(result.user.id).failed_attempts == 0
        
        # Audit logged
        - audit_log.contains(UserLoggedIn {
            user_id: result.user.id,
            session_id: result.session.id,
            ip_address: input.ip_address
          })
      }

      INVALID_CREDENTIALS implies {
        # Failed attempt tracked
        - User.lookup_by_email(input.email) != null implies
            User.lookup_by_email(input.email).failed_attempts == 
              old(User.lookup_by_email(input.email).failed_attempts) + 1
        
        # No session created
        - no Session created
        
        # Check for lock trigger
        - User.lookup_by_email(input.email).failed_attempts >= 5 implies
            User.lookup_by_email(input.email).status == LOCKED
      }

      USER_LOCKED implies {
        - no Session created
        - User.lookup_by_email(input.email).status == LOCKED
        - result.error.locked_until == User.lookup_by_email(input.email).locked_until
      }

      failure implies {
        - no Session created
        - no token generated
      }
    }

    # ============================================
    # Invariants
    # ============================================

    invariants {
      - password never stored in plaintext
      - password never appears in logs
      - password comparison is constant-time (timing attack resistant)
      - session token cryptographically secure (256-bit minimum entropy)
      - failed attempts tracked regardless of user existence (prevent enumeration)
      - same error message for invalid email and invalid password
    }

    # ============================================
    # Temporal Constraints
    # ============================================

    temporal {
      - within 200ms (p50): response returned
      - within 500ms (p95): response returned
      - within 2s (p99): response returned
      - eventually within 5s: audit log updated
      - eventually within 10s: session cache populated
    }

    # ============================================
    # Security
    # ============================================

    security {
      - rate_limit 100 per hour per ip_address
      - rate_limit 10 per hour per email
      - rate_limit 1000 per hour globally
      - brute_force_protection enabled
      - account_lockout after 5 failed attempts
      - lockout_duration 15m (progressive: 15m, 1h, 24h)
      - require_captcha after 3 failed attempts
    }

    # ============================================
    # Observability
    # ============================================

    observability {
      metrics {
        login_attempts: counter [status, ip_country]
        login_duration: histogram [status]
        failed_login_reasons: counter [reason]
        active_sessions: gauge [user_id]
      }

      traces {
        span: "auth.login"
        attributes: [email_domain, remember_me, has_device_fingerprint]
      }

      logs {
        success: info {
          include: [user_id, session_id, ip_address]
          exclude: [password, token]
        }
        error: warn {
          include: [error_code, ip_address, email_domain]
          exclude: [password, email]
        }
      }
    }
  }

  # ============================================
  # Validate Session Behavior
  # ============================================

  behavior ValidateSession {
    description: "Check if a session is valid and return the associated user"

    actors {
      System {
        for: session_validation
      }
    }

    input {
      session_token: String [sensitive]
    }

    output {
      success: {
        user: User { fields: [id, email, display_name, roles, status] }
        session: Session { fields: [id, expires_at, last_activity_at] }
      }

      errors {
        SESSION_NOT_FOUND {
          when: "Session token is invalid or does not exist"
          retriable: false
          http_status: 401
        }
        SESSION_EXPIRED {
          when: "Session has expired"
          retriable: false
          http_status: 401
        }
        SESSION_REVOKED {
          when: "Session was explicitly revoked"
          retriable: false
          http_status: 401
        }
        USER_INACTIVE {
          when: "Associated user account is inactive"
          retriable: false
          http_status: 403
        }
      }
    }

    preconditions {
      input.session_token != null
      input.session_token.length >= 64
    }

    postconditions {
      success implies {
        - Session.exists_by_token(input.session_token)
        - result.session.status == ACTIVE
        - result.session.expires_at > now()
        - result.user.status == ACTIVE
        - result.session.last_activity_at == now()
      }
    }

    temporal {
      - within 10ms (p50): response returned
      - within 50ms (p99): response returned
    }

    security {
      - rate_limit 10000 per minute per ip_address
      - token comparison is constant-time
    }

    observability {
      metrics {
        session_validations: counter [status]
        session_validation_duration: histogram
      }
    }
  }

  # ============================================
  # Scenarios
  # ============================================

  scenarios Login {
    scenario "Successful login with valid credentials" {
      given {
        user = User.create({
          email: "user@example.com",
          password_hash: hash("SecurePass123"),
          status: ACTIVE,
          email_verified_at: now()
        })
      }

      when {
        Login({
          email: "user@example.com",
          password: "SecurePass123",
          ip_address: "192.168.1.1",
          remember_me: false
        })
      }

      then {
        - result.success == true
        - result.data.user.id == user.id
        - result.data.session != null
        - result.data.token != null
        - Session.exists(result.data.session.id)
      }
    }

    scenario "Login fails with wrong password" {
      given {
        user = User.create({
          email: "user@example.com",
          password_hash: hash("SecurePass123"),
          status: ACTIVE
        })
      }

      when {
        Login({
          email: "user@example.com",
          password: "WrongPassword",
          ip_address: "192.168.1.1"
        })
      }

      then {
        - result.success == false
        - result.error == INVALID_CREDENTIALS
        - user.failed_attempts == 1
      }
    }

    scenario "Account locks after 5 failed attempts" {
      given {
        user = User.create({
          email: "user@example.com",
          password_hash: hash("SecurePass123"),
          status: ACTIVE,
          failed_attempts: 4
        })
      }

      when {
        Login({
          email: "user@example.com",
          password: "WrongPassword",
          ip_address: "192.168.1.1"
        })
      }

      then {
        - result.success == false
        - result.error == USER_LOCKED
        - user.status == LOCKED
        - user.locked_until != null
      }
    }

    scenario "Login with remember_me extends session" {
      given {
        user = User.create({
          email: "user@example.com",
          password_hash: hash("SecurePass123"),
          status: ACTIVE
        })
      }

      when {
        Login({
          email: "user@example.com",
          password: "SecurePass123",
          ip_address: "192.168.1.1",
          remember_me: true
        })
      }

      then {
        - result.success == true
        - result.data.session.expires_at >= now() + 29d
      }
    }
  }

  # ============================================
  # Chaos Engineering
  # ============================================

  chaos Login {
    scenario "Database read failure" {
      inject {
        database_failure(target: "users", operation: "read", probability: 1.0)
      }

      when {
        Login({
          email: "user@example.com",
          password: "SecurePass123",
          ip_address: "192.168.1.1"
        })
      }

      then {
        - result.success == false
        - result.error.retriable == true
        - no session created
      }
    }

    scenario "High latency password verification" {
      inject {
        network_latency(target: "password_hasher", latency: 5s)
      }

      when {
        Login({
          email: "user@example.com",
          password: "SecurePass123",
          ip_address: "192.168.1.1"
        })
      }

      then {
        # Should timeout gracefully
        - result.latency < 10s
        - timeout handled gracefully
      }
    }

    scenario "Concurrent login attempts" {
      inject {
        concurrent_requests(count: 100, target: "login")
      }

      given {
        user = User.create({
          email: "user@example.com",
          password_hash: hash("SecurePass123"),
          status: ACTIVE
        })
      }

      when {
        parallel 100 times {
          Login({
            email: "user@example.com",
            password: "SecurePass123",
            ip_address: "192.168.1.{i}"
          })
        }
      }

      then {
        - all requests complete without deadlock
        - rate limiting applied correctly
        - session count <= max_concurrent_sessions
      }
    }
  }
}
