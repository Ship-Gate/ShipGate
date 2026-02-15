domain Auth version "1.0.0"

// Generated from: "A blog platform where authors can register, write posts with a rich text editor, add tags, and publish or save as draft. Readers can browse posts by tag, search by title/content, and leave comments. Authors can moderate comments on their posts (approve, delete). There's a public homepage showing recent posts, an author dashboard showing their posts and comment notifications, and an admin panel for managing users and flagged content. Posts support featured images via URL."
// Confidence: 85%
// Timestamp: 2026-02-14T07:41:47.448Z

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
