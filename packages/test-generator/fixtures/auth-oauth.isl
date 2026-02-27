// Auth domain fixture: OAuth login behavior
domain Auth {
  version: "1.0.0"
  
  entity User {
    id: UUID [immutable]
    email: String [unique]
    provider: String?
    provider_id: String?
    status: String
  }
  
  entity Session {
    id: UUID [immutable]
    user_id: UUID
    expires_at: Timestamp
  }
  
  behavior OAuthLogin {
    description: "Authenticate user via OAuth provider"
    
    input {
      provider: String
      code: String
      redirect_uri: String
    }
    
    output {
      success: {
        session: Session
        access_token: String
        is_new_user: Boolean
      }
      
      errors {
        INVALID_PROVIDER {
          when: "Provider is not supported"
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
      }
    }
    
    preconditions {
      input.provider in ["google", "github", "facebook", "apple"]
      input.code.length > 0
    }
    
    postconditions {
      success implies {
        Session.exists(result.session.id)
        result.access_token != null
      }
    }
  }
}
