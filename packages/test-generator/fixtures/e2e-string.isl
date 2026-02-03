// E2E Test Generation Fixture: String Constraints
// Tests pattern, format, and length constraint generation
domain StringFixture {
  version: "1.0.0"

  type Email = String {
    format: email
    max_length: 254
  }

  type Username = String {
    min_length: 3
    max_length: 30
    pattern: "^[a-zA-Z0-9_]+$"
  }

  type Password = String {
    min_length: 8
    max_length: 128
  }

  type PhoneNumber = String {
    format: phone
    min_length: 10
    max_length: 15
  }

  type Slug = String {
    format: slug
    min_length: 1
    max_length: 100
  }

  entity Profile {
    id: UUID [immutable, unique]
    email: Email [unique]
    username: Username [unique]
    phone: PhoneNumber?
    bio: String?
    created_at: Timestamp [immutable]
  }

  behavior CreateProfile {
    description: "Create a user profile with string constraints"

    input {
      email: Email
      username: Username
      password: Password [sensitive]
      phone: PhoneNumber?
      bio: String?
    }

    output {
      success: Profile

      errors {
        EMAIL_EXISTS {
          when: "Email is already registered"
          retriable: false
        }
        USERNAME_EXISTS {
          when: "Username is already taken"
          retriable: false
        }
        INVALID_EMAIL {
          when: "Email format is invalid"
          retriable: false
        }
        USERNAME_TOO_SHORT {
          when: "Username is too short"
          retriable: true
        }
        WEAK_PASSWORD {
          when: "Password does not meet requirements"
          retriable: true
        }
      }
    }

    preconditions {
      input.email.length > 0
      input.username.length >= 3
      input.password.length >= 8
      not Profile.exists(email: input.email)
      not Profile.exists(username: input.username)
    }

    postconditions {
      success implies {
        Profile.exists(result.id)
        Profile.lookup(result.id).email == input.email
        Profile.lookup(result.id).username == input.username
      }
    }

    invariants {
      input.password never_appears_in logs
      input.password never_appears_in result
    }
  }
}
