domain UserAPI {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    email: String [unique]
    name: String
    createdAt: DateTime [immutable]
    updatedAt: DateTime
  }

  behavior CreateUser {
    input {
      email: String
      name: String
    }

    output {
      success: User
      errors {
        EMAIL_EXISTS {
          when: "Email already registered"
        }
        INVALID_EMAIL {
          when: "Email format is invalid"
        }
        NAME_REQUIRED {
          when: "Name is empty"
        }
      }
    }

    pre {
      email.is_valid
      name.length > 0
      not User.exists(email)
    }

    post success {
      result.email == input.email
      result.name == input.name
      result.id != null
    }
  }

  behavior GetUser {
    input {
      id: UUID
    }

    output {
      success: User
      errors {
        NOT_FOUND {
          when: "User does not exist"
        }
      }
    }

    pre {
      id != null
    }

    post success {
      result.id == input.id
    }
  }

  behavior UpdateUser {
    input {
      id: UUID
      name: String [optional]
      email: String [optional]
    }

    output {
      success: User
      errors {
        NOT_FOUND {
          when: "User does not exist"
        }
        EMAIL_EXISTS {
          when: "Email already taken by another user"
        }
      }
    }

    pre {
      id != null
      (input.name != null or input.email != null)
    }

    post success {
      result.id == input.id
      if input.name != null then result.name == input.name
      if input.email != null then result.email == input.email
      result.updatedAt > old(result.updatedAt)
    }
  }

  behavior DeleteUser {
    input {
      id: UUID
    }

    output {
      success: Boolean
      errors {
        NOT_FOUND {
          when: "User does not exist"
        }
      }
    }

    pre {
      id != null
    }

    post success {
      not User.exists(input.id)
    }
  }
}
