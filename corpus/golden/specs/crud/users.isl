// CRUD: User management
domain CRUDUsers {
  version: "1.0.0"

  type Email = String { format: email, max_length: 254 }

  enum UserRole {
    USER
    MODERATOR
    ADMIN
  }

  enum UserStatus {
    ACTIVE
    INACTIVE
    SUSPENDED
    DELETED
  }

  entity User {
    id: UUID [immutable, unique]
    email: Email [unique, indexed]
    username: String [unique, indexed]
    display_name: String
    role: UserRole [default: USER]
    status: UserStatus [default: ACTIVE]
    bio: String?
    avatar_url: String?
    phone: String? [pii]
    email_verified: Boolean [default: false]
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      username.length >= 3
      username.length <= 30
      display_name.length > 0
    }

    lifecycle {
      ACTIVE -> SUSPENDED
      SUSPENDED -> ACTIVE
      ACTIVE -> DELETED
      INACTIVE -> ACTIVE
      INACTIVE -> DELETED
    }
  }

  behavior CreateUser {
    description: "Create a new user"

    actors {
      Admin { must: authenticated }
      System { }
    }

    input {
      email: Email
      username: String
      display_name: String
      password: String [sensitive]
      role: UserRole?
      bio: String?
    }

    output {
      success: User

      errors {
        EMAIL_EXISTS {
          when: "Email already registered"
          retriable: false
        }
        USERNAME_EXISTS {
          when: "Username already taken"
          retriable: false
        }
        INVALID_USERNAME {
          when: "Username format invalid"
          retriable: true
        }
        WEAK_PASSWORD {
          when: "Password too weak"
          retriable: true
        }
      }
    }

    pre {
      input.email.is_valid_format
      input.username.length >= 3
      input.password.length >= 8
      not User.exists(email: input.email)
      not User.exists(username: input.username)
    }

    post success {
      - User.exists(result.id)
      - result.email == input.email
      - result.status == ACTIVE
    }
  }

  behavior GetUser {
    description: "Get user by ID"

    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      user_id: UUID
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

    pre {
      User.exists(input.user_id)
    }
  }

  behavior UpdateUser {
    description: "Update user profile"

    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      user_id: UUID
      display_name: String?
      bio: String?
      avatar_url: String?
      phone: String?
    }

    output {
      success: User

      errors {
        NOT_FOUND {
          when: "User not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      User.exists(input.user_id)
      actor.id == input.user_id or actor.role == ADMIN
    }

    post success {
      - result.updated_at > old(User.lookup(input.user_id).updated_at)
    }
  }

  behavior DeleteUser {
    description: "Delete a user"

    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      user_id: UUID
      hard_delete: Boolean?
    }

    output {
      success: Boolean

      errors {
        NOT_FOUND {
          when: "User not found"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized"
          retriable: false
        }
      }
    }

    pre {
      User.exists(input.user_id)
    }

    post success {
      - input.hard_delete == true implies not User.exists(input.user_id)
      - input.hard_delete != true implies User.lookup(input.user_id).status == DELETED
    }
  }

  behavior ListUsers {
    description: "List users with filters"

    actors {
      Admin { must: authenticated }
    }

    input {
      role: UserRole?
      status: UserStatus?
      search: String?
      page: Int?
      page_size: Int?
      sort_by: String?
      sort_order: String?
    }

    output {
      success: {
        users: List<User>
        total_count: Int
        page: Int
        page_size: Int
        has_more: Boolean
      }
    }

    pre {
      input.page == null or input.page >= 1
      input.page_size == null or (input.page_size >= 1 and input.page_size <= 100)
    }
  }

  scenarios CreateUser {
    scenario "create regular user" {
      when {
        result = CreateUser(
          email: "user@example.com",
          username: "newuser",
          display_name: "New User",
          password: "SecurePass123!"
        )
      }

      then {
        result is success
        result.role == USER
        result.status == ACTIVE
      }
    }
  }
}
