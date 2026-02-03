# INVALID: Missing Audit Spec
# This spec is intentionally invalid to demonstrate semantic analysis
# 
# SEMANTIC ERRORS:
# - Behavior DeleteUser has no @intent audit-required
# - AdminAction handles sensitive data without proper audit trail

domain InvalidAuth version "1.0.0"

entity User {
  id: UUID [immutable, unique]
  email: Email [unique]
  role: UserRole
}

enum UserRole {
  USER
  ADMIN
}

# ============================================
# INVALID: Missing audit-required intent
# ============================================

behavior DeleteUser {
  description: "Delete a user account - MISSING AUDIT!"
  
  # SEMANTIC ERROR: Sensitive operation without audit-required
  # Should have: @intent audit-required
  @intent rate-limit-required
  
  input {
    user_id: UUID
    admin_id: UUID
  }
  
  output {
    success: Boolean
    errors {
      NOT_FOUND {
        when: "User does not exist"
        retriable: false
      }
      UNAUTHORIZED {
        when: "Admin does not have permission"
        retriable: false
      }
    }
  }
  
  pre {
    User.exists(input.admin_id)
    User.lookup(input.admin_id).role == ADMIN
  }
  
  post success {
    not User.exists(input.user_id)
  }
}

# ============================================
# INVALID: Rate limit after body parsing
# ============================================

behavior BulkImport {
  description: "Bulk import users - RATE LIMIT ORDERED WRONG!"
  
  # This behavior will be flagged because semantic analysis
  # expects rate limit BEFORE body parsing, but implementation
  # shows rate limit AFTER parsing the large request body
  
  @intent rate-limit-required
  
  input {
    users: [User]
  }
  
  output {
    success: {
      imported_count: Int
    }
    errors {
      RATE_LIMITED {
        when: "Too many import requests"
        retriable: true
      }
    }
  }
}
