domain UserService {
  version: "1.0.0"

  entity User {
    id: String [immutable, unique]
    email: String [unique]
    name: String
    created_at: String [immutable]
  }

  behavior CreateUser {
    input {
      email: String
      name: String
    }

    output {
      success: User
      errors {
        INVALID_EMAIL {
          when: "email does not contain @"
          retriable: false
        }
        EMPTY_NAME {
          when: "name is empty"
          retriable: false
        }
      }
    }

    postconditions {
      success implies {
        - result.id.length > 0
        - result.email == input.email
        - result.name == input.name
      }
    }

    invariants {
      - CreateUser never_throws_unhandled
    }
  }

  behavior GetUser {
    input {
      id: String
    }

    output {
      success: User
      errors {
        NOT_FOUND {
          when: "user with given id does not exist"
          retriable: false
        }
      }
    }

    invariants {
      - GetUser never_throws_unhandled
    }
  }
}
