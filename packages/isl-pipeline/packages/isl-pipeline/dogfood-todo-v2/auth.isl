domain Auth version "1.0.0"

// Generated from: "A todo app where users can register and log in. Each user has their own todo lists. Todos have a title, description, due date, priority (low/medium/high), and completed status. Users can create, edit, delete, and reorder todos. There's a dashboard showing overdue todos, today's todos, and upcoming todos. Users can filter by priority and search by title."
// Confidence: 85%
// Timestamp: 2026-02-14T07:44:23.424Z

behavior UserRegister {
  // Create new user account

  input {
    email: Email
    password: String
    confirmPassword: String
  }

  output {
    success: User
    errors {
      EmailAlreadyExists when "email is taken"
      WeakPassword when "password does not meet requirements"
      PasswordMismatch when "passwords do not match"
    }
  }

  // Intent declarations
  @intent rate-limit-required
  @intent audit-required
  @intent encrypt-at-rest
  @intent no-pii-logging

  pre email is valid format
  pre email is not already registered
  pre password meets complexity requirements
  pre password == confirmPassword
  pre rate limit not exceeded

  post success {
    user record created in database
  }
  post success {
    password is hashed (never stored plain)
  }
  post success {
    welcome email queued
  }
  post success {
    audit event recorded
  }

  invariant password is never stored in plain text
  invariant email is verified before full access

}
