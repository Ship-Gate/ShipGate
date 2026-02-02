# OAuth Login Module
# Provides OAuth 2.0 authentication flow behaviors

module OAuthLogin version "1.0.0"

# ============================================
# Types
# ============================================

type OAuthProvider = enum { GOOGLE, GITHUB, MICROSOFT, APPLE, FACEBOOK }

type OAuthCode = String { min_length: 20, max_length: 2048 }

type OAuthState = String { min_length: 32, max_length: 64 }

type AccessToken = String { min_length: 20, sensitive: true }

type RefreshToken = String { min_length: 20, sensitive: true }

type OAuthScope = String { max_length: 255 }

# ============================================
# Entities
# ============================================

entity OAuthCredential {
  id: UUID [immutable, unique]
  user_id: UUID [indexed]
  provider: OAuthProvider [indexed]
  provider_user_id: String [indexed]
  access_token: AccessToken [secret]
  refresh_token: RefreshToken? [secret]
  scopes: List<OAuthScope>
  expires_at: Timestamp
  created_at: Timestamp [immutable]
  updated_at: Timestamp

  invariants {
    expires_at > created_at
    scopes.length > 0
  }
}

# ============================================
# Behaviors
# ============================================

behavior InitiateOAuth {
  description: "Start OAuth flow by generating authorization URL"

  input {
    provider: OAuthProvider
    redirect_uri: String { format: "uri" }
    scopes: List<OAuthScope>
    state: OAuthState?
  }

  output {
    success: {
      authorization_url: String
      state: OAuthState
    }

    errors {
      INVALID_PROVIDER {
        when: "Provider is not configured"
        retriable: false
      }
      INVALID_REDIRECT_URI {
        when: "Redirect URI not in allowlist"
        retriable: false
      }
    }
  }

  pre {
    scopes.length > 0
    redirect_uri.is_valid_uri
  }

  post success {
    result.state.length >= 32
    result.authorization_url.contains(input.provider.auth_endpoint)
  }

  temporal {
    within 100ms (p99): response returned
  }
}

behavior ExchangeOAuthCode {
  description: "Exchange authorization code for tokens"

  input {
    provider: OAuthProvider
    code: OAuthCode
    state: OAuthState
    redirect_uri: String { format: "uri" }
  }

  output {
    success: OAuthCredential

    errors {
      INVALID_CODE {
        when: "Authorization code is invalid or expired"
        retriable: false
      }
      STATE_MISMATCH {
        when: "State parameter does not match"
        retriable: false
      }
      PROVIDER_ERROR {
        when: "OAuth provider returned an error"
        retriable: true
        retry_after: 5s
      }
    }
  }

  pre {
    code.length >= 20
    state.length >= 32
  }

  post success {
    OAuthCredential.exists(result.id)
    result.access_token.length > 0
    result.expires_at > now()
  }

  invariants {
    code used only once
    tokens stored encrypted at rest
  }

  temporal {
    within 2s (p99): response returned
  }

  security {
    rate_limit 100 per minute per ip
  }
}

behavior RefreshOAuthToken {
  description: "Refresh expired OAuth access token"

  input {
    credential_id: UUID
  }

  output {
    success: OAuthCredential

    errors {
      CREDENTIAL_NOT_FOUND {
        when: "OAuth credential does not exist"
        retriable: false
      }
      NO_REFRESH_TOKEN {
        when: "No refresh token available"
        retriable: false
      }
      REFRESH_FAILED {
        when: "Provider rejected refresh request"
        retriable: true
        retry_after: 30s
      }
    }
  }

  pre {
    OAuthCredential.exists(credential_id)
    OAuthCredential.lookup(credential_id).refresh_token != null
  }

  post success {
    result.access_token != old(OAuthCredential.lookup(credential_id).access_token)
    result.expires_at > now()
    result.updated_at == now()
  }

  temporal {
    within 3s (p99): response returned
  }
}

behavior RevokeOAuthCredential {
  description: "Revoke OAuth credential and tokens"

  input {
    credential_id: UUID
    revoke_at_provider: Boolean [default: true]
  }

  output {
    success: Boolean

    errors {
      CREDENTIAL_NOT_FOUND {
        when: "OAuth credential does not exist"
        retriable: false
      }
      REVOCATION_FAILED {
        when: "Failed to revoke at provider"
        retriable: true
        retry_after: 5s
      }
    }
  }

  pre {
    OAuthCredential.exists(credential_id)
  }

  post success {
    not OAuthCredential.exists(credential_id)
  }

  temporal {
    within 5s (p99): response returned
    eventually within 1m: audit log updated
  }
}
