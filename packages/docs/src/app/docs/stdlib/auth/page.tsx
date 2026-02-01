import { CodeBlock } from "@/components/CodeBlock";

export const metadata = {
  title: "Authentication - ISL Standard Library",
  description: "Pre-built authentication specifications.",
};

export default function AuthPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6 lg:px-8">
      <div className="prose prose-invert max-w-none">
        <h1>Authentication</h1>

        <p className="lead text-xl text-muted-foreground">
          Complete authentication specifications including users, sessions, 
          login, registration, and password management.
        </p>

        <h2>Import</h2>

        <CodeBlock
          code={`import { User, Session, Login, Register, Logout, ResetPassword } from "@stdlib/auth"`}
          language="isl"
        />

        <h2>Entities</h2>

        <h3>User</h3>

        <CodeBlock
          code={`entity User {
  id: UUID [immutable, unique]
  email: Email [unique, indexed]
  password_hash: String [secret]
  status: UserStatus [indexed]
  created_at: Timestamp [immutable]
  updated_at: Timestamp
  last_login: Timestamp?
  email_verified: Boolean [default: false]
  email_verified_at: Timestamp?

  invariants {
    email_verified implies email_verified_at != null
    status == DELETED implies deleted_at != null
  }

  lifecycle {
    PENDING -> ACTIVE
    ACTIVE -> SUSPENDED
    SUSPENDED -> ACTIVE
    ACTIVE -> DELETED
    SUSPENDED -> DELETED
  }
}

enum UserStatus {
  PENDING
  ACTIVE
  SUSPENDED
  DELETED
}`}
          language="isl"
        />

        <h3>Session</h3>

        <CodeBlock
          code={`entity Session {
  id: UUID [immutable, unique]
  user_id: UUID [immutable, indexed]
  token_hash: String [secret]
  created_at: Timestamp [immutable]
  expires_at: Timestamp
  revoked_at: Timestamp?
  ip_address: String?
  user_agent: String?

  invariants {
    expires_at > created_at
    revoked_at != null implies revoked_at <= now()
  }
}`}
          language="isl"
        />

        <h2>Behaviors</h2>

        <h3>Register</h3>

        <CodeBlock
          code={`behavior Register {
  description: "Create a new user account"

  actors {
    Anonymous { for: registration }
  }

  input {
    email: Email
    password: Password [sensitive]
    name: String?
  }

  output {
    success: User { status: PENDING }
    errors {
      EMAIL_EXISTS { when: "Email already registered" }
      WEAK_PASSWORD { when: "Password too weak" }
    }
  }

  preconditions {
    not User.exists_by_email(input.email)
    input.password.strength >= MEDIUM
  }

  postconditions {
    success implies {
      - User.exists(result.id)
      - result.email == input.email
      - result.status == PENDING
      - result.password_hash != input.password
    }
  }

  temporal {
    - within 1s (p99): response returned
    - eventually within 5m: verification email sent
  }

  security {
    - rate_limit 10 per hour per ip_address
  }
}`}
          language="isl"
        />

        <h3>Login</h3>

        <CodeBlock
          code={`behavior Login {
  description: "Authenticate user and create session"

  actors {
    Anonymous { for: authentication }
  }

  input {
    email: Email
    password: Password [sensitive]
    remember_me: Boolean?
  }

  output {
    success: {
      user: User
      session: Session
      token: String
    }
    errors {
      INVALID_CREDENTIALS { when: "Email or password incorrect" }
      USER_SUSPENDED { when: "Account suspended" }
      USER_NOT_VERIFIED { when: "Email not verified" }
    }
  }

  preconditions {
    User.exists_by_email(input.email)
  }

  postconditions {
    success implies {
      - Session.exists(result.session.id)
      - result.user.last_login == now()
    }
    INVALID_CREDENTIALS implies {
      - User.increment_failed_attempts(input.email)
    }
  }

  invariants {
    - password never logged
    - timing attack resistant
  }

  temporal {
    - within 500ms (p99): response returned
  }

  security {
    - rate_limit 100 per hour per ip_address
    - rate_limit 10 per hour per email
    - brute_force_protection enabled
  }
}`}
          language="isl"
        />

        <h3>Logout</h3>

        <CodeBlock
          code={`behavior Logout {
  description: "Invalidate user session"

  actors {
    User { must: authenticated }
  }

  input {
    session_id: UUID?  # Optional, defaults to current
    all_sessions: Boolean?  # Logout all sessions
  }

  output {
    success: Boolean
    errors {
      SESSION_NOT_FOUND { when: "Session not found" }
    }
  }

  postconditions {
    success implies {
      - input.all_sessions implies User.sessions.all(s => s.revoked_at != null)
      - not input.all_sessions implies Session(session_id).revoked_at != null
    }
  }

  temporal {
    - immediately: session invalid
    - eventually within 5s: session removed from cache
  }
}`}
          language="isl"
        />

        <h3>ResetPassword</h3>

        <CodeBlock
          code={`behavior RequestPasswordReset {
  description: "Send password reset email"

  actors {
    Anonymous { for: password_reset }
  }

  input {
    email: Email
  }

  output {
    success: Boolean  # Always true to prevent email enumeration
  }

  postconditions {
    User.exists_by_email(input.email) implies {
      - ResetToken.created_for_user(input.email)
      - eventually email sent to input.email
    }
  }

  security {
    - rate_limit 3 per hour per email
    - rate_limit 10 per hour per ip_address
  }
}

behavior ResetPassword {
  description: "Reset password using token"

  input {
    token: String
    new_password: Password [sensitive]
  }

  output {
    success: Boolean
    errors {
      INVALID_TOKEN { when: "Token invalid or expired" }
      WEAK_PASSWORD { when: "Password too weak" }
    }
  }

  postconditions {
    success implies {
      - User.password_hash != old(User.password_hash)
      - token invalidated
      - all sessions revoked
    }
  }

  temporal {
    - eventually within 5m: notification email sent
  }

  security {
    - token expires after 1 hour
    - token single use
  }
}`}
          language="isl"
        />

        <h2>Extending Auth</h2>

        <CodeBlock
          code={`import { User, Login } from "@stdlib/auth"

# Add custom fields to User
entity User extends @stdlib/auth.User {
  organization_id: UUID?
  role: UserRole [default: MEMBER]
  
  invariants {
    role == ADMIN implies organization_id == null
  }
}

# Add 2FA to Login
behavior Login extends @stdlib/auth.Login {
  input {
    ...  # Inherit existing inputs
    totp_code: String?  # Add 2FA
  }
  
  preconditions {
    ...  # Inherit existing preconditions
    User.has_2fa_enabled implies input.totp_code != null
  }
}`}
          language="isl"
        />
      </div>
    </div>
  );
}
