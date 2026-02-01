/**
 * {{name}} Domain
 * 
 * A comprehensive ISL project template with authentication example.
 */

domain {{pascalName}} {
  // ─────────────────────────────────────────────────────────────────────────
  // Entities
  // ─────────────────────────────────────────────────────────────────────────

  entity User {
    id: ID
    username: String
    email: String
    passwordHash: String
    role: UserRole
    createdAt: DateTime
    lastLoginAt: DateTime?
  }

  enum UserRole {
    ADMIN
    MEMBER
    GUEST
  }

  entity AuthToken {
    token: String
    userId: ID
    expiresAt: DateTime
    scopes: List<String>
  }

  entity Session {
    id: ID
    userId: ID
    token: AuthToken
    userAgent: String?
    ipAddress: String?
    createdAt: DateTime
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Behaviors
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a new user
   */
  behavior Register {
    input {
      username: String
      email: String
      password: String
    }
    
    output User
    
    preconditions {
      require input.username.length >= 3 as "Username must be at least 3 characters"
      require input.email.contains("@") as "Invalid email format"
      require input.password.length >= 8 as "Password must be at least 8 characters"
    }
    
    postconditions {
      ensure result.username == input.username
      ensure result.email == input.email
      ensure result.role == UserRole.MEMBER
      ensure result.passwordHash != input.password
    }
    
    scenario "successful registration" {
      given {
        username: "alice"
        email: "alice@example.com"
        password: "secure123"
      }
      then {
        result.username == "alice"
        result.role == UserRole.MEMBER
      }
    }
  }

  /**
   * Authenticate user and create session
   */
  behavior Login {
    input {
      email: String
      password: String
    }
    
    output Session
    
    postconditions {
      ensure result.token.expiresAt > now()
    }
    
    scenario "successful login" {
      given {
        email: "alice@example.com"
        password: "secure123"
      }
      then {
        result.token != null
      }
    }
    
    scenario "invalid credentials" {
      given {
        email: "alice@example.com"
        password: "wrongpassword"
      }
      then fails with "Invalid credentials"
    }
  }

  /**
   * End user session
   */
  behavior Logout {
    input {
      sessionId: ID
    }
    
    output Boolean
    
    postconditions {
      ensure result == true
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Invariants
  // ─────────────────────────────────────────────────────────────────────────

  invariant "emails are unique" {
    forall u1, u2: User =>
      u1.id != u2.id implies u1.email != u2.email
  }

  invariant "usernames are unique" {
    forall u1, u2: User =>
      u1.id != u2.id implies u1.username != u2.username
  }

  invariant "sessions reference valid users" {
    forall s: Session =>
      exists u: User where u.id == s.userId
  }
}
