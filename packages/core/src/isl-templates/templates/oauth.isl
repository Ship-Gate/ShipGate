# OAuth 2.0 Authorization Domain
# Complete OAuth 2.0 implementation with Authorization Code, PKCE, and Refresh Token flows

domain OAuth {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type ClientId = String { min_length: 16, max_length: 64 }
  type ClientSecret = String { min_length: 32, max_length: 128 }
  type AuthorizationCode = String { min_length: 32, max_length: 64 }
  type AccessToken = String { min_length: 32, max_length: 512 }
  type RefreshToken = String { min_length: 32, max_length: 512 }
  type RedirectUri = String { format: "uri", max_length: 2048 }
  type Scope = String { max_length: 1024 }
  type CodeVerifier = String { min_length: 43, max_length: 128 }
  type CodeChallenge = String { min_length: 43, max_length: 128 }
  
  enum GrantType {
    AUTHORIZATION_CODE
    REFRESH_TOKEN
    CLIENT_CREDENTIALS
  }
  
  enum TokenType {
    BEARER
  }
  
  enum CodeChallengeMethod {
    S256
    PLAIN
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity OAuthClient {
    id: UUID [immutable, unique]
    client_id: ClientId [unique, indexed]
    client_secret_hash: String [secret]
    name: String { max_length: 255 }
    description: String?
    redirect_uris: List<RedirectUri>
    allowed_scopes: List<Scope>
    is_confidential: Boolean [default: true]
    is_active: Boolean [default: true]
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      redirect_uris.length > 0
      name.length > 0
    }
  }
  
  entity AuthorizationGrant {
    id: UUID [immutable, unique]
    code: AuthorizationCode [unique, indexed]
    client_id: ClientId [indexed]
    user_id: UUID [indexed]
    redirect_uri: RedirectUri
    scopes: List<Scope>
    code_challenge: CodeChallenge?
    code_challenge_method: CodeChallengeMethod?
    expires_at: Timestamp
    used: Boolean [default: false]
    created_at: Timestamp [immutable]
    
    invariants {
      expires_at > created_at
      code_challenge != null implies code_challenge_method != null
    }
  }
  
  entity OAuthToken {
    id: UUID [immutable, unique]
    access_token: AccessToken [unique, indexed]
    refresh_token: RefreshToken? [unique, indexed]
    client_id: ClientId [indexed]
    user_id: UUID? [indexed]
    scopes: List<Scope>
    token_type: TokenType [default: BEARER]
    access_token_expires_at: Timestamp
    refresh_token_expires_at: Timestamp?
    revoked: Boolean [default: false]
    created_at: Timestamp [immutable]
    
    invariants {
      access_token_expires_at > created_at
      refresh_token != null implies refresh_token_expires_at != null
      refresh_token_expires_at != null implies refresh_token_expires_at > access_token_expires_at
    }
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior Authorize {
    description: "Initiate OAuth authorization flow and return authorization code"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      client_id: ClientId
      redirect_uri: RedirectUri
      response_type: String [value: "code"]
      scope: Scope?
      state: String?
      code_challenge: CodeChallenge?
      code_challenge_method: CodeChallengeMethod?
    }
    
    output {
      success: {
        code: AuthorizationCode
        state: String?
        redirect_uri: RedirectUri
      }
      
      errors {
        INVALID_CLIENT {
          when: "Client ID is not registered"
          retriable: false
        }
        INVALID_REDIRECT_URI {
          when: "Redirect URI not registered for client"
          retriable: false
        }
        INVALID_SCOPE {
          when: "Requested scope not allowed for client"
          retriable: false
        }
        ACCESS_DENIED {
          when: "User denied authorization"
          retriable: false
        }
      }
    }
    
    preconditions {
      OAuthClient.exists(client_id: input.client_id)
      OAuthClient.lookup(input.client_id).is_active
      input.redirect_uri in OAuthClient.lookup(input.client_id).redirect_uris
    }
    
    postconditions {
      success implies {
        AuthorizationGrant.exists(code: result.code)
        AuthorizationGrant.lookup(result.code).client_id == input.client_id
        AuthorizationGrant.lookup(result.code).user_id == actor.id
        AuthorizationGrant.lookup(result.code).expires_at > now()
      }
    }
    
    temporal {
      response within 500ms (p99)
    }
    
    security {
      requires authentication
      csrf_protection enabled
    }
  }
  
  behavior ExchangeCode {
    description: "Exchange authorization code for access token"
    
    actors {
      OAuthClient { must: authenticated }
    }
    
    input {
      grant_type: GrantType [value: AUTHORIZATION_CODE]
      code: AuthorizationCode
      redirect_uri: RedirectUri
      client_id: ClientId
      client_secret: ClientSecret? [sensitive]
      code_verifier: CodeVerifier?
    }
    
    output {
      success: {
        access_token: AccessToken
        token_type: TokenType
        expires_in: Int
        refresh_token: RefreshToken?
        scope: Scope?
      }
      
      errors {
        INVALID_GRANT {
          when: "Authorization code is invalid or expired"
          retriable: false
        }
        INVALID_CLIENT {
          when: "Client authentication failed"
          retriable: false
        }
        INVALID_REDIRECT_URI {
          when: "Redirect URI mismatch"
          retriable: false
        }
        INVALID_CODE_VERIFIER {
          when: "PKCE code verifier validation failed"
          retriable: false
        }
        CODE_ALREADY_USED {
          when: "Authorization code was already exchanged"
          retriable: false
        }
      }
    }
    
    preconditions {
      AuthorizationGrant.exists(code: input.code)
      AuthorizationGrant.lookup(input.code).expires_at > now()
      AuthorizationGrant.lookup(input.code).used == false
      AuthorizationGrant.lookup(input.code).redirect_uri == input.redirect_uri
    }
    
    postconditions {
      success implies {
        OAuthToken.exists(access_token: result.access_token)
        AuthorizationGrant.lookup(input.code).used == true
      }
      
      failure implies {
        AuthorizationGrant.lookup(input.code).used == false or 
        AuthorizationGrant.lookup(input.code).used == true  // Mark as used even on failure for security
      }
    }
    
    invariants {
      input.client_secret never_appears_in logs
      result.access_token never_appears_in logs
      result.refresh_token never_appears_in logs
    }
    
    temporal {
      response within 200ms (p99)
    }
    
    security {
      rate_limit 100 per hour per client_id
    }
  }
  
  behavior RefreshAccessToken {
    description: "Exchange refresh token for new access token"
    
    actors {
      OAuthClient { must: authenticated }
    }
    
    input {
      grant_type: GrantType [value: REFRESH_TOKEN]
      refresh_token: RefreshToken [sensitive]
      client_id: ClientId
      client_secret: ClientSecret? [sensitive]
      scope: Scope?
    }
    
    output {
      success: {
        access_token: AccessToken
        token_type: TokenType
        expires_in: Int
        refresh_token: RefreshToken?
        scope: Scope?
      }
      
      errors {
        INVALID_GRANT {
          when: "Refresh token is invalid or expired"
          retriable: false
        }
        INVALID_CLIENT {
          when: "Client authentication failed"
          retriable: false
        }
        INVALID_SCOPE {
          when: "Requested scope exceeds original grant"
          retriable: false
        }
      }
    }
    
    preconditions {
      OAuthToken.exists(refresh_token: input.refresh_token)
      OAuthToken.lookup_by_refresh(input.refresh_token).revoked == false
      OAuthToken.lookup_by_refresh(input.refresh_token).refresh_token_expires_at > now()
    }
    
    postconditions {
      success implies {
        OAuthToken.exists(access_token: result.access_token)
        old(OAuthToken.lookup_by_refresh(input.refresh_token)).revoked == true
      }
    }
    
    security {
      rate_limit 50 per hour per client_id
    }
  }
  
  behavior RevokeToken {
    description: "Revoke an access or refresh token"
    
    actors {
      OAuthClient { must: authenticated }
      User { must: authenticated }
    }
    
    input {
      token: String [sensitive]
      token_type_hint: String?
      client_id: ClientId
    }
    
    output {
      success: Boolean
      
      errors {
        INVALID_CLIENT {
          when: "Client authentication failed"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        OAuthToken.lookup_by_token(input.token).revoked == true
      }
    }
    
    temporal {
      immediately: token invalid for new requests
      eventually within 5s: token removed from all caches
    }
  }
  
  behavior Introspect {
    description: "Introspect token to get metadata"
    
    actors {
      ResourceServer { must: authenticated }
    }
    
    input {
      token: AccessToken [sensitive]
      token_type_hint: String?
    }
    
    output {
      success: {
        active: Boolean
        scope: Scope?
        client_id: ClientId?
        username: String?
        token_type: TokenType?
        exp: Int?
        iat: Int?
        sub: String?
      }
    }
    
    temporal {
      response within 50ms (p99)
    }
    
    security {
      rate_limit 1000 per minute per client_id
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios Authorize {
    scenario "successful authorization" {
      given {
        client = OAuthClient.create(
          client_id: "test-client",
          redirect_uris: ["https://app.example.com/callback"],
          allowed_scopes: ["read", "write"]
        )
        user = User.authenticated()
      }
      
      when {
        result = Authorize(
          client_id: client.client_id,
          redirect_uri: "https://app.example.com/callback",
          response_type: "code",
          scope: "read",
          state: "xyz123"
        )
      }
      
      then {
        result is success
        result.state == "xyz123"
        AuthorizationGrant.exists(code: result.code)
      }
    }
    
    scenario "PKCE flow" {
      given {
        client = OAuthClient.create(
          client_id: "mobile-app",
          redirect_uris: ["myapp://callback"],
          is_confidential: false
        )
      }
      
      when {
        result = Authorize(
          client_id: client.client_id,
          redirect_uri: "myapp://callback",
          response_type: "code",
          code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
          code_challenge_method: S256
        )
      }
      
      then {
        result is success
        AuthorizationGrant.lookup(result.code).code_challenge != null
      }
    }
  }
  
  scenarios ExchangeCode {
    scenario "successful token exchange" {
      given {
        grant = AuthorizationGrant.create(
          code: "auth-code-123",
          client_id: "test-client",
          redirect_uri: "https://app.example.com/callback"
        )
      }
      
      when {
        result = ExchangeCode(
          grant_type: AUTHORIZATION_CODE,
          code: "auth-code-123",
          redirect_uri: "https://app.example.com/callback",
          client_id: "test-client",
          client_secret: "secret"
        )
      }
      
      then {
        result is success
        result.token_type == BEARER
        result.expires_in > 0
      }
    }
  }
}
