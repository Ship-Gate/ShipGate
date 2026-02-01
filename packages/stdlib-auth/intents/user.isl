# User Entity Specification
#
# Defines the User entity with all fields, constraints, and lifecycle.

domain Auth.User {
  version: "0.1.0"

  # ============================================
  # Types
  # ============================================

  type UserId = UUID { immutable: true, unique: true }
  
  type Email = String { 
    format: "email"
    max_length: 254
  }

  type PasswordHash = String {
    min_length: 60
    secret: true
  }

  # ============================================
  # Enums
  # ============================================

  enum UserStatus {
    PENDING_VERIFICATION {
      description: "User registered but email not verified"
    }
    ACTIVE {
      description: "User is active and can authenticate"
    }
    INACTIVE {
      description: "User account is deactivated"
    }
    LOCKED {
      description: "User account is locked due to security reasons"
    }
    SUSPENDED {
      description: "User account suspended by administrator"
    }
  }

  enum UserRole {
    USER {
      description: "Standard user role"
    }
    ADMIN {
      description: "Administrator role"
    }
    SUPER_ADMIN {
      description: "Super administrator with full access"
    }
  }

  # ============================================
  # Entity
  # ============================================

  entity User {
    # Primary identifier
    id: UserId [immutable, unique, indexed]
    
    # Authentication fields
    email: Email [unique, indexed, searchable]
    password_hash: PasswordHash [secret, never_log]
    
    # Status and roles
    status: UserStatus [indexed, default: PENDING_VERIFICATION]
    roles: List<UserRole> [default: [USER]]
    
    # Timestamps
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    last_login: Timestamp?
    email_verified_at: Timestamp?
    
    # Security tracking
    failed_attempts: Int [default: 0]
    locked_until: Timestamp?
    password_changed_at: Timestamp?
    
    # Metadata
    display_name: String? [max_length: 100]
    avatar_url: String? [format: "url"]

    # ============================================
    # Invariants
    # ============================================

    invariants {
      # ID constraints
      id != null
      
      # Email constraints
      email.is_valid_format
      email.length <= 254
      
      # Failed attempts constraints
      failed_attempts >= 0
      failed_attempts <= 10
      
      # Status-lock relationship
      locked_until != null implies status == LOCKED
      status == LOCKED implies (locked_until != null or failed_attempts >= 10)
      
      # Verification constraints
      status == ACTIVE implies email_verified_at != null
      email_verified_at != null implies email_verified_at <= now()
      
      # Timestamp constraints
      created_at <= updated_at
      last_login == null or last_login >= created_at
      password_changed_at == null or password_changed_at >= created_at
      
      # Role constraints
      roles.length >= 1
      roles.contains(USER) or roles.contains(ADMIN) or roles.contains(SUPER_ADMIN)
    }

    # ============================================
    # Lifecycle
    # ============================================

    lifecycle {
      # Initial state
      initial: PENDING_VERIFICATION

      # Transitions
      PENDING_VERIFICATION -> ACTIVE {
        when: email_verified_at != null
        action: verify_email
      }
      
      ACTIVE -> LOCKED {
        when: failed_attempts >= 5 or manual_lock
        action: lock_account
      }
      
      LOCKED -> ACTIVE {
        when: locked_until < now() or manual_unlock or password_reset
        action: unlock_account
      }
      
      ACTIVE -> INACTIVE {
        when: user_request or admin_deactivate
        action: deactivate_account
      }
      
      INACTIVE -> ACTIVE {
        when: user_request and email_verified
        action: reactivate_account
      }
      
      ACTIVE -> SUSPENDED {
        when: admin_suspend
        action: suspend_account
      }
      
      SUSPENDED -> ACTIVE {
        when: admin_unsuspend
        action: unsuspend_account
      }

      # Terminal states (no transitions out)
      # None - all states can transition
    }

    # ============================================
    # Computed Fields
    # ============================================

    computed {
      is_locked: Boolean = status == LOCKED and (locked_until == null or locked_until > now())
      is_active: Boolean = status == ACTIVE
      is_verified: Boolean = email_verified_at != null
      can_login: Boolean = is_active and not is_locked
      days_since_password_change: Int? = password_changed_at != null 
        ? (now() - password_changed_at).days 
        : null
    }

    # ============================================
    # Indexes
    # ============================================

    indexes {
      primary: id
      unique: email
      index: [status, created_at]
      index: [last_login]
    }
  }

  # ============================================
  # User Queries
  # ============================================

  queries {
    find_by_email(email: Email): User? {
      preconditions {
        email.is_valid_format
      }
      
      returns: User.where(email == input.email).first
    }

    find_by_id(id: UserId): User? {
      returns: User.where(id == input.id).first
    }

    find_active_users(): List<User> {
      returns: User.where(status == ACTIVE).all
    }

    find_locked_users(): List<User> {
      returns: User.where(status == LOCKED).all
    }

    count_by_status(status: UserStatus): Int {
      returns: User.where(status == input.status).count
    }
  }

  # ============================================
  # User Commands
  # ============================================

  commands {
    increment_failed_attempts(user: User): User {
      preconditions {
        user.status != SUSPENDED
      }
      
      postconditions {
        result.failed_attempts == old(user.failed_attempts) + 1
        result.failed_attempts >= 5 implies result.status == LOCKED
      }
    }

    reset_failed_attempts(user: User): User {
      postconditions {
        result.failed_attempts == 0
        result.locked_until == null if old(user.failed_attempts) < 10
      }
    }

    update_last_login(user: User, timestamp: Timestamp): User {
      preconditions {
        user.status == ACTIVE
        timestamp <= now()
      }
      
      postconditions {
        result.last_login == timestamp
        result.updated_at >= old(user.updated_at)
      }
    }
  }
}
