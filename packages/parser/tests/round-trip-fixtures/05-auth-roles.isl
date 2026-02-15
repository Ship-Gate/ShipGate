domain AuthRoles {
  version: "1.0.0"

  enum Role {
    ADMIN
    USER
    GUEST
  }

  entity User {
    id: UUID [immutable, unique]
    email: String [unique]
    role: Role
  }

  behavior AssignRole {
    actors {
      User { must: admin }
    }
    input {
      user_id: UUID
      role: Role
    }
    output {
      success: User
    }
    preconditions {
      - User.exists(input.user_id)
    }
  }

  behavior CheckAccess {
    input {
      user_id: UUID
      required_role: Role
    }
    output {
      success: Boolean
    }
  }
}
