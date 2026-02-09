domain Auth {
  version: "1.0.0"

  behavior GetUser {
    description: "Get user profile (requires authentication)"

    input {
      user_id: UUID
    }

    output {
      success: User
      errors {
        NOT_FOUND {
          when: "User does not exist"
        }
        UNAUTHORIZED {
          when: "User is not authenticated"
        }
      }
    }

    preconditions {
      input.user_id.is_valid
    }

    security {
      requires auth
    }
  }

  behavior UpdateUser {
    description: "Update user profile (requires admin role)"

    input {
      actor_id: UUID
      target_user_id: UUID
      updates: UserUpdates
    }

    output {
      success: User
      errors {
        FORBIDDEN {
          when: "Actor does not have admin role"
        }
      }
    }

    preconditions {
      User.exists(actor_id)
      User.exists(target_user_id)
      User.lookup(actor_id).role == ADMIN
    }

    security {
      requires role ADMIN
    }
  }

  behavior CreatePost {
    description: "Create a new post (requires authenticated user)"

    input {
      author_id: UUID
      title: String
      content: String
    }

    output {
      success: Post
    }

    preconditions {
      User.exists(author_id)
      title.length > 0
    }

    security {
      requires auth
    }
  }

  behavior PublicHealthCheck {
    description: "Public health check endpoint"

    output {
      success: {
        status: String
        timestamp: Timestamp
      }
    }

    # No security block - this is intentionally public
  }
}
