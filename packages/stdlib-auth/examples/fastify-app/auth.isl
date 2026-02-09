# Fastify App Auth Specification
# ISL spec for the sample Fastify app

domain FastifyAuthApp {
  version: "1.0.0"
  
  import { Login, Logout, ValidateSession } from "@intentos/stdlib-auth/behaviors/authenticate"
  import { CheckPermission } from "@intentos/stdlib-auth/behaviors/authorize"
  
  # App-specific behaviors that use stdlib-auth
  
  behavior GetProtectedResource {
    description: "Access protected resource requiring authentication"
    
    input {
      session_token: String [sensitive]
    }
    
    output {
      success: {
        data: Map<String, Any>
        user: User
      }
      
      errors {
        UNAUTHORIZED {
          when: "Session invalid or expired"
          http_status: 401
        }
      }
    }
    
    preconditions {
      input.session_token != null
    }
    
    postconditions {
      success implies {
        - ValidateSession(session_token: input.session_token).success == true
        - result.user != null
      }
    }
    
    security {
      requires authentication
    }
  }
  
  behavior GetAdminResource {
    description: "Access admin resource requiring admin role"
    
    input {
      session_token: String [sensitive]
    }
    
    output {
      success: {
        data: Map<String, Any>
        user: User
      }
      
      errors {
        UNAUTHORIZED {
          when: "Session invalid or expired"
          http_status: 401
        }
        FORBIDDEN {
          when: "User lacks admin role"
          http_status: 403
        }
      }
    }
    
    preconditions {
      input.session_token != null
    }
    
    postconditions {
      success implies {
        - ValidateSession(session_token: input.session_token).success == true
        - CheckPermission(
            user_id: result.user.id,
            resource: "admin",
            action: "read"
          ).allowed == true
      }
    }
    
    security {
      requires authentication
      requires role: admin
    }
  }
}
