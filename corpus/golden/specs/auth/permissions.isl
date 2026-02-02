// Authentication: Role-based access control
domain AuthPermissions {
  version: "1.0.0"

  enum Role {
    USER
    MODERATOR
    ADMIN
    SUPER_ADMIN
  }

  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    role: Role [default: USER]
    custom_permissions: List<String>
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }

  entity Permission {
    id: UUID [immutable, unique]
    name: String [unique]
    description: String
    resource: String
    action: String
    created_at: Timestamp [immutable]

    invariants {
      name.length > 0
      resource.length > 0
      action.length > 0
    }
  }

  entity RolePermission {
    id: UUID [immutable, unique]
    role: Role
    permission_id: UUID [indexed]
    created_at: Timestamp [immutable]
  }

  behavior CheckPermission {
    description: "Check if user has a specific permission"

    actors {
      System { }
    }

    input {
      user_id: UUID
      permission: String
      resource_id: UUID?
    }

    output {
      success: { allowed: Boolean, reason: String? }

      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        INVALID_PERMISSION {
          when: "Permission does not exist"
          retriable: false
        }
      }
    }

    pre {
      User.exists(input.user_id)
    }

    temporal {
      - within 5ms (p50): response returned
      - within 20ms (p99): response returned
    }
  }

  behavior AssignRole {
    description: "Assign a role to a user"

    actors {
      Admin { must: authenticated }
      SuperAdmin { must: authenticated }
    }

    input {
      user_id: UUID
      role: Role
    }

    output {
      success: User

      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        INSUFFICIENT_PRIVILEGES {
          when: "Cannot assign higher role"
          retriable: false
        }
        SELF_ASSIGNMENT {
          when: "Cannot change own role"
          retriable: false
        }
      }
    }

    pre {
      User.exists(input.user_id)
      actor.id != input.user_id
      // Can only assign roles lower than own
      input.role < actor.role or actor.role == SUPER_ADMIN
    }

    post success {
      - User.lookup(input.user_id).role == input.role
      - User.lookup(input.user_id).updated_at > old(User.lookup(input.user_id).updated_at)
    }

    temporal {
      - eventually within 1s: role change reflected in all services
    }
  }

  behavior GrantPermission {
    description: "Grant custom permission to user"

    actors {
      Admin { must: authenticated }
    }

    input {
      user_id: UUID
      permission: String
    }

    output {
      success: User

      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        PERMISSION_NOT_FOUND {
          when: "Permission does not exist"
          retriable: false
        }
        ALREADY_GRANTED {
          when: "User already has this permission"
          retriable: false
        }
      }
    }

    pre {
      User.exists(input.user_id)
      Permission.exists(name: input.permission)
    }

    post success {
      - input.permission in User.lookup(input.user_id).custom_permissions
    }
  }

  behavior RevokePermission {
    description: "Revoke custom permission from user"

    actors {
      Admin { must: authenticated }
    }

    input {
      user_id: UUID
      permission: String
    }

    output {
      success: User

      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        PERMISSION_NOT_GRANTED {
          when: "User does not have this permission"
          retriable: false
        }
      }
    }

    pre {
      User.exists(input.user_id)
      input.permission in User.lookup(input.user_id).custom_permissions
    }

    post success {
      - input.permission not in User.lookup(input.user_id).custom_permissions
    }
  }

  behavior ListPermissions {
    description: "List all permissions for a user"

    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }

    input {
      user_id: UUID
    }

    output {
      success: {
        role: Role
        role_permissions: List<Permission>
        custom_permissions: List<Permission>
        effective_permissions: List<Permission>
      }

      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Not authorized to view permissions"
          retriable: false
        }
      }
    }

    pre {
      User.exists(input.user_id)
      actor.id == input.user_id or actor.role >= ADMIN
    }
  }

  policy PermissionPolicy {
    description: "Default permission checks"

    rules {
      rule "super admins have all permissions" {
        when: actor.role == SUPER_ADMIN
        allow: *
      }

      rule "admins can manage users" {
        when: actor.role == ADMIN
        allow: [User.read, User.update]
      }

      rule "users can view own profile" {
        when: actor.id == resource.id
        allow: [User.read]
      }

      default: deny
    }
  }

  scenarios AssignRole {
    scenario "admin assigns moderator role" {
      given {
        admin = User.create(role: ADMIN)
        user = User.create(role: USER)
      }

      when {
        result = AssignRole(user_id: user.id, role: MODERATOR)
      }

      then {
        result is success
        result.role == MODERATOR
      }
    }

    scenario "admin cannot assign admin role" {
      given {
        admin = User.create(role: ADMIN)
        user = User.create(role: USER)
      }

      when {
        result = AssignRole(user_id: user.id, role: ADMIN)
      }

      then {
        result is INSUFFICIENT_PRIVILEGES
      }
    }
  }
}
