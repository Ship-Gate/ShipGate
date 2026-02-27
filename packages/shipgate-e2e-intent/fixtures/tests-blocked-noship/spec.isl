domain AuthService {
  version: "1.0.0"

  entity Session {
    id: String [immutable, unique]
    user_id: String
    token: String [secret]
    expires_at: String
  }

  behavior Login {
    input {
      username: String
      password: String
    }

    output {
      success: Session
      errors {
        INVALID_CREDENTIALS {
          when: "username or password is wrong"
          retriable: false
        }
        ACCOUNT_LOCKED {
          when: "too many failed attempts"
          retriable: false
        }
      }
    }

    postconditions {
      success implies {
        - result.id.length > 0
        - result.user_id.length > 0
        - result.token.length > 10
      }
    }

    invariants {
      - Login never_throws_unhandled
    }
  }
}
