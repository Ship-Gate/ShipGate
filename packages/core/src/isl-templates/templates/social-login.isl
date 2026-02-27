# Social Login (SSO) Domain
# OAuth-based social login with multiple providers

domain SocialLogin {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type ProviderUserId = String { max_length: 255 }
  
  enum SocialProvider {
    GOOGLE
    GITHUB
    APPLE
    FACEBOOK
    MICROSOFT
    TWITTER
    LINKEDIN
    DISCORD
    SLACK
  }
  
  enum ConnectionStatus {
    ACTIVE
    DISCONNECTED
    EXPIRED
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity SocialConnection {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    provider: SocialProvider [indexed]
    provider_user_id: ProviderUserId [indexed]
    email: String? [indexed]
    name: String?
    avatar_url: String?
    access_token: String? [secret]
    refresh_token: String? [secret]
    token_expires_at: Timestamp?
    scopes: List<String>?
    profile_data: Map<String, Any>?
    status: ConnectionStatus [default: ACTIVE]
    connected_at: Timestamp [immutable]
    last_used_at: Timestamp
    disconnected_at: Timestamp?
    
    invariants {
      (user_id, provider) is unique  # One connection per provider per user
      provider_user_id unique per provider
    }
  }
  
  entity SocialLoginState {
    id: UUID [immutable, unique]
    state_token: String [unique, indexed]
    provider: SocialProvider
    redirect_uri: String
    code_verifier: String?  # PKCE
    requested_scopes: List<String>?
    link_to_user_id: UUID?  # For linking to existing account
    metadata: Map<String, String>?
    expires_at: Timestamp
    created_at: Timestamp [immutable]
    
    invariants {
      expires_at > created_at
    }
  }
  
  entity ProviderConfig {
    id: UUID [immutable, unique]
    provider: SocialProvider [unique]
    client_id: String
    client_secret: String [secret]
    authorization_url: String
    token_url: String
    userinfo_url: String?
    scopes: List<String>
    is_enabled: Boolean [default: true]
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior InitiateLogin {
    description: "Start social login flow"
    
    actors {
      Anonymous { }
      User { must: authenticated }  # For linking accounts
    }
    
    input {
      provider: SocialProvider
      redirect_uri: String
      scopes: List<String>?
      link_to_account: Boolean?
    }
    
    output {
      success: {
        authorization_url: String
        state: String
      }
      
      errors {
        PROVIDER_NOT_ENABLED {
          when: "Provider is not enabled"
          retriable: false
        }
        PROVIDER_NOT_CONFIGURED {
          when: "Provider is not configured"
          retriable: false
        }
        INVALID_REDIRECT_URI {
          when: "Redirect URI not allowed"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        SocialLoginState.exists(state_token: result.state)
      }
    }
  }
  
  behavior HandleCallback {
    description: "Handle OAuth callback and authenticate/link user"
    
    actors {
      Anonymous { }
    }
    
    input {
      provider: SocialProvider
      code: String
      state: String
      error: String?
      error_description: String?
    }
    
    output {
      success: {
        user_id: UUID
        is_new_user: Boolean
        is_linked: Boolean
        session: Session?
        access_token: String?
        profile: {
          email: String?
          name: String?
          avatar_url: String?
        }
      }
      
      errors {
        INVALID_STATE {
          when: "State parameter invalid or expired"
          retriable: false
        }
        PROVIDER_ERROR {
          when: "Provider returned an error"
          retriable: false
        }
        EMAIL_ALREADY_REGISTERED {
          when: "Email is registered with different login method"
          retriable: false
        }
        ACCOUNT_ALREADY_LINKED {
          when: "Provider account already linked to another user"
          retriable: false
        }
        TOKEN_EXCHANGE_FAILED {
          when: "Failed to exchange code for tokens"
          retriable: true
        }
        PROFILE_FETCH_FAILED {
          when: "Failed to fetch user profile"
          retriable: true
        }
      }
    }
    
    preconditions {
      input.error == null
      SocialLoginState.exists(state_token: input.state)
      SocialLoginState.lookup(input.state).expires_at > now()
    }
    
    postconditions {
      success implies {
        SocialConnection.exists(
          provider: input.provider,
          user_id: result.user_id
        )
        not result.is_linked implies Session.exists(user_id: result.user_id)
      }
    }
    
    effects {
      Email { send_welcome if is_new_user }
      AuditLog { log_social_login }
    }
  }
  
  behavior DisconnectProvider {
    description: "Disconnect a social login provider"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      provider: SocialProvider
    }
    
    output {
      success: Boolean
      
      errors {
        CONNECTION_NOT_FOUND {
          when: "No connection found for this provider"
          retriable: false
        }
        LAST_LOGIN_METHOD {
          when: "Cannot disconnect the only login method"
          retriable: false
        }
      }
    }
    
    preconditions {
      SocialConnection.exists(user_id: actor.id, provider: input.provider)
      // Must have another login method
      User.lookup(actor.id).has_password or 
        SocialConnection.count(user_id: actor.id) > 1
    }
    
    postconditions {
      success implies {
        SocialConnection.lookup(actor.id, input.provider).status == DISCONNECTED
      }
    }
    
    effects {
      AuditLog { log_provider_disconnected }
    }
  }
  
  behavior ListConnections {
    description: "List user's social connections"
    
    actors {
      User { must: authenticated }
    }
    
    output {
      success: {
        connections: List<{
          provider: SocialProvider
          email: String?
          name: String?
          connected_at: Timestamp
          last_used_at: Timestamp
          status: ConnectionStatus
        }>
        available_providers: List<SocialProvider>
      }
    }
  }
  
  behavior RefreshProviderToken {
    description: "Refresh OAuth tokens for a provider"
    
    actors {
      System { }
    }
    
    input {
      connection_id: UUID
    }
    
    output {
      success: SocialConnection
      
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
          when: "Token refresh failed"
          retriable: true
        }
      }
    }
    
    postconditions {
      success implies {
        SocialConnection.lookup(input.connection_id).access_token != 
          old(SocialConnection.lookup(input.connection_id).access_token)
      }
    }
  }
  
  behavior SyncProfile {
    description: "Sync user profile from social provider"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      provider: SocialProvider
    }
    
    output {
      success: {
        updated_fields: List<String>
        profile: Map<String, Any>
      }
      
      errors {
        CONNECTION_NOT_FOUND {
          when: "No connection found for this provider"
          retriable: false
        }
        SYNC_FAILED {
          when: "Failed to fetch profile from provider"
          retriable: true
        }
      }
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios HandleCallback {
    scenario "new user registration" {
      given {
        state = SocialLoginState.create(
          provider: GOOGLE,
          state_token: "state-123"
        )
      }
      
      when {
        result = HandleCallback(
          provider: GOOGLE,
          code: "auth-code",
          state: "state-123"
        )
      }
      
      then {
        result is success
        result.is_new_user == true
        User.exists(result.user_id)
        SocialConnection.exists(provider: GOOGLE)
      }
    }
    
    scenario "existing user login" {
      given {
        connection = SocialConnection.create(
          user_id: user.id,
          provider: GITHUB,
          provider_user_id: "github-123"
        )
        state = SocialLoginState.create(
          provider: GITHUB,
          state_token: "state-456"
        )
      }
      
      when {
        result = HandleCallback(
          provider: GITHUB,
          code: "auth-code",
          state: "state-456"
        )
      }
      
      then {
        result is success
        result.is_new_user == false
        result.user_id == user.id
      }
    }
    
    scenario "link to existing account" {
      given {
        state = SocialLoginState.create(
          provider: APPLE,
          state_token: "state-789",
          link_to_user_id: user.id
        )
      }
      
      when {
        result = HandleCallback(
          provider: APPLE,
          code: "auth-code",
          state: "state-789"
        )
      }
      
      then {
        result is success
        result.is_linked == true
        SocialConnection.exists(user_id: user.id, provider: APPLE)
      }
    }
  }
}
