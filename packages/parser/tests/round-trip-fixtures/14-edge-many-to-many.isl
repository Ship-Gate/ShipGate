domain EdgeManyToMany {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    name: String
  }

  entity Group {
    id: UUID [immutable, unique]
    name: String
  }

  entity UserGroup {
    id: UUID [immutable, unique]
    user_id: UUID
    group_id: UUID
  }

  behavior AddUserToGroup {
    input {
      user_id: UUID
      group_id: UUID
    }
    output {
      success: UserGroup
      errors {
        ALREADY_MEMBER { when: "User already in group" retriable: false }
      }
    }
  }

  behavior RemoveUserFromGroup {
    input {
      user_id: UUID
      group_id: UUID
    }
    output {
      success: Boolean
    }
  }
}
