domain Users {
  version: "1.0.0"

  behavior GetUser {
    description: "Retrieve a user's public profile by their ID"

    actors {
      AuthenticatedUser {
        must: authenticated
      }
    }

    input {
      id: UUID
    }

    output {
      success: {
        id: UUID
        email: String
        name: String
        created_at: Timestamp
      }
      errors {
        NOT_FOUND {
          when: "No user exists with the given ID"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Request lacks a valid Bearer token"
          retriable: false
        }
      }
    }

    preconditions {
      caller is authenticated
    }

    postconditions {
      success implies {
        result.id == input.id
      }

      NOT_FOUND implies {
        response.status == 404
      }

      UNAUTHORIZED implies {
        response.status == 401
      }
    }

    invariants {
      // Sensitive fields are never exposed in API responses
      password_hash never_appears_in response
    }

    temporal {
      within 100ms (p95): response returned
    }
  }

  scenarios GetUser {
    scenario "retrieve existing user" {
      given {
        user = CreateUser(
          email: "alice@example.com",
          name: "Alice",
          password: "Str0ng!Pass"
        )
        token = Login(
          email: "alice@example.com",
          password: "Str0ng!Pass"
        ).token
      }
      when {
        result = GetUser(id: user.id)
      }
      then {
        result is success
        result.id == user.id
        result.email == "alice@example.com"
        result.name == "Alice"
      }
    }

    scenario "return 404 for unknown ID" {
      given {
        token = Login(
          email: "alice@example.com",
          password: "Str0ng!Pass"
        ).token
      }
      when {
        result = GetUser(id: "00000000-0000-0000-0000-000000000000")
      }
      then {
        result is NOT_FOUND
      }
    }

    scenario "reject unauthenticated request" {
      when {
        result = GetUser(id: "any-id")
      }
      then {
        result is UNAUTHORIZED
      }
    }
  }
}
