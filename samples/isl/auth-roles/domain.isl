# Auth + Roles — Canonical Sample
# Authentication with role-based access control
# Covers: pre/post, invariants, security constraints, scenarios

domain AuthRoles {
  version: "1.0.0"

  enum Role {
    VIEWER
    EDITOR
    ADMIN
    SUPER_ADMIN
  }

  enum AccountStatus {
    ACTIVE
    SUSPENDED
    LOCKED
    PENDING_VERIFICATION
  }

  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    password_hash: String [secret]
    role: Role [default: VIEWER, indexed]
    status: AccountStatus [default: PENDING_VERIFICATION]
    failed_login_count: Int [default: 0]
    last_login_at: Timestamp?
    created_at: Timestamp [immutable]

    invariants {
      failed_login_count >= 0
      failed_login_count > 5 implies status == LOCKED
    }
  }

  entity Session {
    id: UUID [immutable, unique]
    user_id: UUID [immutable, indexed]
    token: String [secret, unique]
    expires_at: Timestamp
    revoked: Boolean [default: false]
    created_at: Timestamp [immutable]

    invariants {
      expires_at > created_at
    }
  }

  entity Permission {
    id: UUID [immutable, unique]
    role: Role [indexed]
    resource: String
    action: String

    invariants {
      SUPER_ADMIN has all permissions
    }
  }

  behavior Register {
    description: "Register a new user account"

    input {
      email: String
      password: String [sensitive]
      confirm_password: String [sensitive]
    }

    output {
      success: User
      errors {
        EMAIL_TAKEN {
          when: "A user with this email already exists"
          retriable: false
        }
        PASSWORDS_MISMATCH {
          when: "Password and confirmation do not match"
          retriable: true
        }
        WEAK_PASSWORD {
          when: "Password does not meet strength requirements"
          retriable: true
        }
      }
    }

    pre {
      email.is_valid
      password.length >= 12
      password == confirm_password
      not User.exists_by_email(email)
    }

    post success {
      - User.exists(result.id)
      - result.email == input.email
      - result.password_hash != input.password
      - result.role == VIEWER
      - result.status == PENDING_VERIFICATION
    }

    invariants {
      - password never_logged
      - password_hash uses bcrypt or argon2
    }
  }

  behavior Login {
    description: "Authenticate and create a session"

    input {
      email: String
      password: String [sensitive]
    }

    output {
      success: Session
      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
          retriable: true
        }
        ACCOUNT_LOCKED {
          when: "Account locked after too many failed attempts"
          retriable: false
        }
        ACCOUNT_SUSPENDED {
          when: "Account has been suspended by admin"
          retriable: false
        }
        NOT_VERIFIED {
          when: "Account email not yet verified"
          retriable: false
        }
      }
    }

    pre {
      email.is_valid
      password.length >= 1
    }

    post success {
      - Session.exists(result.id)
      - Session.expires_at > now()
      - Session.revoked == false
      - User.lookup_by_email(input.email).last_login_at == now()
      - User.lookup_by_email(input.email).failed_login_count == 0
    }

    post error INVALID_CREDENTIALS {
      - User.lookup_by_email(input.email).failed_login_count == old(failed_login_count) + 1
    }

    invariants {
      - password never_logged
      - failed_login_count > 5 triggers ACCOUNT_LOCKED
    }

    temporal {
      within 500ms (p99): response returned
    }

    security {
      rate_limit 10 per minute per ip
    }
  }

  behavior AssignRole {
    description: "Assign a role to a user (admin only)"

    input {
      actor_id: UUID
      target_user_id: UUID
      new_role: Role
    }

    output {
      success: User
      errors {
        FORBIDDEN {
          when: "Actor does not have permission to assign roles"
          retriable: false
        }
        USER_NOT_FOUND {
          when: "Target user does not exist"
          retriable: false
        }
        CANNOT_SELF_PROMOTE {
          when: "User cannot change their own role to a higher level"
          retriable: false
        }
        ESCALATION_BLOCKED {
          when: "Cannot assign role higher than actor's own role"
          retriable: false
        }
      }
    }

    pre {
      User.exists(actor_id)
      User.exists(target_user_id)
      User.lookup(actor_id).role in [ADMIN, SUPER_ADMIN]
    }

    post success {
      - User.lookup(target_user_id).role == input.new_role
    }

    invariants {
      - actor.role >= new_role (no privilege escalation)
      - only SUPER_ADMIN can assign ADMIN role
      - role changes are audit-logged
    }
  }

  behavior CheckPermission {
    description: "Check if a user has permission for a resource action"

    input {
      user_id: UUID
      resource: String
      action: String
    }

    output {
      success: {
        allowed: Boolean
        reason: String?
      }
      errors {
        USER_NOT_FOUND {
          when: "User does not exist"
          retriable: false
        }
      }
    }

    pre {
      User.exists(user_id)
    }

    post success {
      - User.lookup(user_id).role == SUPER_ADMIN implies result.allowed == true
      - result.allowed == Permission.exists_for(User.lookup(user_id).role, input.resource, input.action)
    }

    temporal {
      within 10ms (p99): response returned
    }
  }

  behavior Logout {
    description: "Revoke a session"

    input {
      session_id: UUID
    }

    output {
      success: Boolean
      errors {
        SESSION_NOT_FOUND {
          when: "Session does not exist"
          retriable: false
        }
      }
    }

    pre {
      Session.exists(session_id)
    }

    post success {
      - Session.lookup(session_id).revoked == true
    }
  }

  scenario "Role escalation prevention" {
    step admin = Register({ email: "admin@test.com", password: "SecurePass123!", confirm_password: "SecurePass123!" })
    # Assume admin is promoted to ADMIN externally

    step editor = Register({ email: "editor@test.com", password: "SecurePass456!", confirm_password: "SecurePass456!" })

    # ADMIN cannot assign SUPER_ADMIN
    step escalate = AssignRole({ actor_id: admin.result.id, target_user_id: editor.result.id, new_role: SUPER_ADMIN })
    assert escalate.error == ESCALATION_BLOCKED
  }

  scenario "Account lockout after failed logins" {
    step user = Register({ email: "lock@test.com", password: "SecurePass789!", confirm_password: "SecurePass789!" })

    step fail1 = Login({ email: "lock@test.com", password: "wrong" })
    step fail2 = Login({ email: "lock@test.com", password: "wrong" })
    step fail3 = Login({ email: "lock@test.com", password: "wrong" })
    step fail4 = Login({ email: "lock@test.com", password: "wrong" })
    step fail5 = Login({ email: "lock@test.com", password: "wrong" })
    step fail6 = Login({ email: "lock@test.com", password: "wrong" })

    step locked = Login({ email: "lock@test.com", password: "SecurePass789!" })
    assert locked.error == ACCOUNT_LOCKED
  }
}
