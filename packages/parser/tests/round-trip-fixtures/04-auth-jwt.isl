domain AuthJwt {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    email: String [unique]
    jwt_sub: String
  }

  behavior IssueToken {
    description: "Issue JWT for user"
    input {
      user_id: UUID
      expires_in: Duration
    }
    output {
      success: String
    }
    preconditions {
      - User.exists(input.user_id)
    }
    postconditions {
      success implies {
        - result.length > 0
      }
    }
  }

  behavior ValidateToken {
    input {
      token: String
    }
    output {
      success: User
      errors {
        EXPIRED { when: "Token expired" retriable: false }
        INVALID { when: "Invalid token" retriable: false }
      }
    }
  }
}
