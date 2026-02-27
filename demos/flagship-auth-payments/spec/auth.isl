# OAuth Authentication Domain
# 
# Defines behavioral contracts for OAuth-based authentication including
# Google/GitHub social login, session management, and token refresh.

domain OAuthAuthentication {
  version: "1.0.0"
  owner: "flagship-demo"

  # ============================================
  # Types
  # ============================================

  type Email = String { format: email, max_length: 254 }
  type UserId = UUID { immutable: true, unique: true }
  type SessionId = UUID { immutable: true, unique: true }
  type OAuthToken = String { min_length: 20, max_length: 2048 }
  type RefreshToken = String { min_length: 32, max_length: 256 }

  # ============================================
  # Enums
  # ============================================

  enum OAuthProvider {
    GOOGLE
    GITHUB
    MICROSOFT
  }

  enum UserStatus {
    ACTIVE
    INACTIVE
    PENDING_VERIFICATION
    SUSPENDED
  }

  enum SessionStatus {
    ACTIVE
    EXPIRED
    REVOKED
  }

  # ============================================
  # Entities
  # ============================================

  entity User {
    id: UserId [immutable, unique]
    email: Email [unique, indexed]
    display_name: String?
    avatar_url: String?
    oauth_provider: OAuthProvider
    oauth_id: String [indexed]
    status: UserStatus [indexed]
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    last_login: Timestamp?

    invariants {
      oauth_id.length > 0
      email.length > 0
    }

    lifecycle {
      PENDING_VERIFICATION -> ACTIVE
      ACTIVE -> SUSPENDED
      SUSPENDED -> ACTIVE
      ACTIVE -> INACTIVE
    }
  }

  entity Session {
    id: SessionId [immutable, unique]
    user_id: UserId [immutable, indexed]
    access_token_hash: String [secret]
    refresh_token_hash: String [secret]
    status: SessionStatus
    ip_address: String [pii]
    user_agent: String?
    expires_at: Timestamp
    created_at: Timestamp [immutable]

    invariants {
      expires_at > created_at
      status == ACTIVE implies expires_at > now()
    }
  }

  # ============================================
  # Behaviors
  # ============================================

  behavior OAuthLogin {
    description: "Authenticate user via OAuth provider (Google, GitHub, etc.)"

    actors {
      Anonymous {
        for: authentication
      }
    }

    input {
      provider: OAuthProvider
      oauth_code: String
      redirect_uri: String
      ip_address: String
      user_agent: String?
    }

    output {
      success: {
        user: User
        session: Session
        access_token: String
        refresh_token: RefreshToken
      }

      errors {
        INVALID_OAUTH_CODE {
          when: "OAuth authorization code is invalid or expired"
          retriable: false
        }
        PROVIDER_ERROR {
          when: "OAuth provider returned an error"
          retriable: true
          retry_after: 5s
        }
        USER_SUSPENDED {
          when: "User account has been suspended"
          retriable: false
        }
        INVALID_REDIRECT_URI {
          when: "Redirect URI does not match registered URIs"
          retriable: false
        }
      }
    }

    pre {
      oauth_code.length > 0
      redirect_uri.length > 0
      provider in [GOOGLE, GITHUB, MICROSOFT]
    }

    post success {
      - User.exists(result.user.id)
      - Session.exists(result.session.id)
      - Session.user_id == result.user.id
      - Session.status == ACTIVE
      - Session.expires_at > now()
      - User.last_login == now()
      - User.status in [ACTIVE, PENDING_VERIFICATION]
    }

    post INVALID_OAUTH_CODE {
      - no Session created
      - audit log contains failed attempt
    }

    post failure {
      - no Session created
    }

    invariants {
      - oauth_code never logged
      - access_token cryptographically secure
      - refresh_token cryptographically secure
    }

    temporal {
      - within 2s (p50): response returned
      - within 5s (p99): response returned
    }

    security {
      - rate_limit 20 per minute per ip_address
      - csrf_protection enabled
    }
  }

  behavior RefreshAccessToken {
    description: "Refresh an expired access token using a valid refresh token"

    actors {
      User {
        must: has_refresh_token
      }
    }

    input {
      refresh_token: RefreshToken [sensitive]
    }

    output {
      success: {
        access_token: String
        expires_in: Int
      }

      errors {
        INVALID_REFRESH_TOKEN {
          when: "Refresh token is invalid"
          retriable: false
        }
        REFRESH_TOKEN_EXPIRED {
          when: "Refresh token has expired"
          retriable: false
        }
        SESSION_REVOKED {
          when: "Session was revoked"
          retriable: false
        }
      }
    }

    pre {
      refresh_token.length >= 32
    }

    post success {
      - Session.status == ACTIVE
      - new access_token issued
      - result.expires_in > 0
    }

    post INVALID_REFRESH_TOKEN {
      - Session.status != ACTIVE implies no new token
    }

    temporal {
      - within 100ms (p50): response returned
      - within 500ms (p99): response returned
    }

    security {
      - rate_limit 60 per hour per session
    }
  }

  behavior Logout {
    description: "Revoke a user session"

    actors {
      User {
        must: authenticated
        owns: session
      }
    }

    input {
      session_id: SessionId
      revoke_all: Boolean?
    }

    output {
      success: {
        revoked_count: Int
      }

      errors {
        SESSION_NOT_FOUND {
          when: "Session does not exist"
          retriable: false
        }
        UNAUTHORIZED {
          when: "User does not own this session"
          retriable: false
        }
      }
    }

    pre {
      session_id.is_valid_format
    }

    post success {
      - Session.lookup(session_id).status == REVOKED
      - input.revoke_all implies all user sessions revoked
      - result.revoked_count >= 1
    }

    temporal {
      - immediately: session invalid for new requests
      - within 30s: session removed from all caches
    }
  }

  behavior ValidateSession {
    description: "Validate if a session is active and return user info"

    actors {
      System {
        for: session_validation
      }
    }

    input {
      access_token: String [sensitive]
    }

    output {
      success: {
        user: User
        session: Session
      }

      errors {
        INVALID_TOKEN {
          when: "Access token is invalid"
          retriable: false
        }
        TOKEN_EXPIRED {
          when: "Access token has expired"
          retriable: false
        }
        SESSION_REVOKED {
          when: "Session was revoked"
          retriable: false
        }
        USER_SUSPENDED {
          when: "User is suspended"
          retriable: false
        }
      }
    }

    pre {
      access_token.length > 0
    }

    post success {
      - User.status == ACTIVE
      - Session.status == ACTIVE
      - Session.expires_at > now()
    }

    temporal {
      - within 10ms (p50): response returned
      - within 50ms (p99): response returned
    }
  }

  # ============================================
  # Scenarios
  # ============================================

  scenarios OAuthLogin {
    scenario "successful Google OAuth login - new user" {
      given {
        oauth_response = mock_google_oauth(email: "alice@example.com", name: "Alice")
      }

      when {
        result = OAuthLogin(
          provider: GOOGLE,
          oauth_code: "valid_auth_code_123",
          redirect_uri: "http://localhost:3000/callback",
          ip_address: "192.168.1.1"
        )
      }

      then {
        result is success
        result.user.email == "alice@example.com"
        result.user.oauth_provider == GOOGLE
        result.session.status == ACTIVE
      }
    }

    scenario "successful GitHub OAuth login - existing user" {
      given {
        user = User.create(email: "bob@github.com", oauth_provider: GITHUB, status: ACTIVE)
        oauth_response = mock_github_oauth(email: "bob@github.com")
      }

      when {
        result = OAuthLogin(
          provider: GITHUB,
          oauth_code: "github_code_456",
          redirect_uri: "http://localhost:3000/callback",
          ip_address: "10.0.0.1"
        )
      }

      then {
        result is success
        result.user.id == user.id
        result.user.last_login == now()
      }
    }

    scenario "OAuth login with invalid code" {
      when {
        result = OAuthLogin(
          provider: GOOGLE,
          oauth_code: "invalid_code",
          redirect_uri: "http://localhost:3000/callback",
          ip_address: "192.168.1.1"
        )
      }

      then {
        result is INVALID_OAUTH_CODE
      }
    }

    scenario "OAuth login with suspended user" {
      given {
        user = User.create(email: "suspended@example.com", oauth_provider: GOOGLE, status: SUSPENDED)
        oauth_response = mock_google_oauth(email: "suspended@example.com")
      }

      when {
        result = OAuthLogin(
          provider: GOOGLE,
          oauth_code: "valid_code",
          redirect_uri: "http://localhost:3000/callback",
          ip_address: "192.168.1.1"
        )
      }

      then {
        result is USER_SUSPENDED
      }
    }
  }

  scenarios RefreshAccessToken {
    scenario "successful token refresh" {
      given {
        session = Session.create(status: ACTIVE, expires_at: now() + 1.hour)
      }

      when {
        result = RefreshAccessToken(refresh_token: session.refresh_token)
      }

      then {
        result is success
        result.expires_in > 0
      }
    }

    scenario "refresh with expired token" {
      given {
        session = Session.create(status: EXPIRED)
      }

      when {
        result = RefreshAccessToken(refresh_token: "expired_token")
      }

      then {
        result is REFRESH_TOKEN_EXPIRED
      }
    }
  }

  # ============================================
  # Global Invariants
  # ============================================

  invariants SecurityBoundaries {
    description: "Security invariants for OAuth authentication"
    scope: global

    always {
      - oauth tokens never stored in plaintext
      - access tokens cryptographically signed
      - refresh tokens rotated on use
      - all auth events logged
      - failed attempts tracked per IP
    }
  }
}
