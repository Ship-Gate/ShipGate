// Authentication: OAuth 2.0 provider integration
domain AuthOAuth {
  version: "1.0.0"

  enum OAuthProvider {
    GOOGLE
    GITHUB
    MICROSOFT
    APPLE
  }

  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    name: String?
    avatar_url: String?
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }

  entity OAuthConnection {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    provider: OAuthProvider
    provider_user_id: String [indexed]
    access_token: String [secret]
    refresh_token: String? [secret]
    token_expires_at: Timestamp?
    scopes: List<String>
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      provider_user_id.length > 0
    }
  }

  entity OAuthState {
    id: UUID [immutable, unique]
    state_token: String [unique]
    redirect_uri: String
    provider: OAuthProvider
    expires_at: Timestamp
    used: Boolean [default: false]
    created_at: Timestamp [immutable]

    invariants {
      expires_at > created_at
    }
  }

  behavior InitiateOAuth {
    description: "Start OAuth flow and return authorization URL"

    actors {
      Anonymous { }
    }

    input {
      provider: OAuthProvider
      redirect_uri: String
      scopes: List<String>?
    }

    output {
      success: {
        authorization_url: String
        state: String
      }

      errors {
        INVALID_PROVIDER {
          when: "Provider is not supported"
          retriable: false
        }
        INVALID_REDIRECT_URI {
          when: "Redirect URI is not allowed"
          retriable: false
        }
      }
    }

    post success {
      - OAuthState.exists(state: result.state)
      - OAuthState.lookup(result.state).provider == input.provider
      - OAuthState.lookup(result.state).expires_at > now()
    }

    security {
      - state token cryptographically random
      - state token single-use
      - redirect_uri must match allowed list
    }
  }

  behavior CompleteOAuth {
    description: "Complete OAuth flow with authorization code"

    actors {
      Anonymous { }
    }

    input {
      code: String
      state: String
    }

    output {
      success: {
        user: User
        session_token: String
        is_new_user: Boolean
      }

      errors {
        INVALID_STATE {
          when: "State token is invalid or expired"
          retriable: false
        }
        INVALID_CODE {
          when: "Authorization code is invalid"
          retriable: false
        }
        PROVIDER_ERROR {
          when: "OAuth provider returned an error"
          retriable: true
        }
        EMAIL_CONFLICT {
          when: "Email is already used by another account"
          retriable: false
        }
      }
    }

    pre {
      OAuthState.exists(state: input.state)
      OAuthState.lookup(input.state).used == false
      OAuthState.lookup(input.state).expires_at > now()
    }

    post success {
      - OAuthState.lookup(input.state).used == true
      - OAuthConnection.exists(user_id: result.user.id)
    }

    post failure {
      - OAuthState.lookup(input.state).used == true
    }

    temporal {
      - within 5s (p99): response returned
    }
  }

  behavior UnlinkOAuth {
    description: "Remove OAuth connection from account"

    actors {
      User { must: authenticated }
    }

    input {
      provider: OAuthProvider
    }

    output {
      success: Boolean

      errors {
        CONNECTION_NOT_FOUND {
          when: "No connection exists for this provider"
          retriable: false
        }
        LAST_AUTH_METHOD {
          when: "Cannot remove last authentication method"
          retriable: false
        }
      }
    }

    pre {
      OAuthConnection.exists(user_id: actor.id, provider: input.provider)
    }

    post success {
      - not OAuthConnection.exists(user_id: actor.id, provider: input.provider)
    }
  }

  behavior RefreshOAuthToken {
    description: "Refresh expired OAuth access token"

    actors {
      System { }
    }

    input {
      connection_id: UUID
    }

    output {
      success: OAuthConnection

      errors {
        CONNECTION_NOT_FOUND {
          when: "Connection does not exist"
          retriable: false
        }
        NO_REFRESH_TOKEN {
          when: "No refresh token available"
          retriable: false
        }
        REFRESH_FAILED {
          when: "Provider rejected refresh request"
          retriable: true
        }
      }
    }

    pre {
      OAuthConnection.exists(input.connection_id)
      OAuthConnection.lookup(input.connection_id).refresh_token != null
    }

    post success {
      - result.access_token != old(OAuthConnection.lookup(input.connection_id).access_token)
      - result.token_expires_at > now()
    }
  }

  scenarios CompleteOAuth {
    scenario "new user via Google" {
      given {
        state = OAuthState.create(provider: GOOGLE, used: false)
      }

      when {
        result = CompleteOAuth(code: "auth-code", state: state.state_token)
      }

      then {
        result is success
        result.is_new_user == true
      }
    }

    scenario "existing user via GitHub" {
      given {
        user = User.create(email: "user@example.com")
        connection = OAuthConnection.create(user_id: user.id, provider: GITHUB)
        state = OAuthState.create(provider: GITHUB, used: false)
      }

      when {
        result = CompleteOAuth(code: "auth-code", state: state.state_token)
      }

      then {
        result is success
        result.is_new_user == false
        result.user.id == user.id
      }
    }
  }
}
