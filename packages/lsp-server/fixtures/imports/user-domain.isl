// User domain that imports from common types
domain UserDomain {
  version: "1.0.0"

  imports { Email, UserId, Status, Address } from "./common-types"

  entity User {
    id: UserId
    email: Email
    status: Status
    address: Address?
    createdAt: Timestamp
  }

  behavior CreateUser {
    description: "Create a new user account"

    input {
      email: Email
      address: Address?
    }

    output {
      success: User

      errors {
        EMAIL_EXISTS {
          when: "Email already registered"
          retriable: false
        }
        INVALID_EMAIL {
          when: "Email format is invalid"
          retriable: true
        }
      }
    }

    preconditions {
      email != null
      not User.exists_by_email(email)
    }

    postconditions {
      success implies {
        User.exists(result.id)
        result.email == input.email
        result.status == ACTIVE
      }
    }

    temporal {
      response within 500.ms (p99)
    }

    security {
      rate_limit: 10 per minute
    }
  }

  behavior GetUser {
    description: "Get user by ID"

    input {
      id: UserId
    }

    output {
      success: User

      errors {
        NOT_FOUND {
          when: "User not found"
          retriable: false
        }
      }
    }

    preconditions {
      id != null
    }

    postconditions {
      success implies {
        result.id == input.id
      }
    }

    temporal {
      response within 100.ms (p99)
    }
  }

  scenarios CreateUser {
    scenario "Successfully create user" {
      given {
        email = "test@example.com"
      }

      when {
        result = CreateUser({ email: email })
      }

      then {
        result.email == email
        result.status == ACTIVE
      }
    }

    scenario "Fail with existing email" {
      given {
        existingUser = User({ email: "existing@example.com" })
      }

      when {
        result = CreateUser({ email: "existing@example.com" })
      }

      then {
        result is EMAIL_EXISTS
      }
    }
  }
}
