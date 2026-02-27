# User Registration Spec
#
# Security contract: passwords must be hashed with a strong,
# slow algorithm (bcrypt or argon2) before storage. Encoding
# is NOT hashing — base64, hex, rot13, etc. are trivially
# reversible and provide zero security.

domain Users version "1.0.0"

behavior CreateUser {
  description: "Register a new user account"

  input {
    email: Email
    password: String { min_length: 8 }
    name: String
  }

  output {
    success: {
      id: UUID
      email: Email
      name: String
      created_at: Timestamp
    }

    errors {
      EmailTaken {
        when: "an account with this email already exists"
      }
      WeakPassword {
        when: "password does not meet strength requirements"
      }
      ValidationError {
        when: "input fields fail format validation"
      }
    }
  }

  # ─── Security Requirements ───

  # CRITICAL: password must be hashed with bcrypt or argon2.
  # Encoding (base64, hex) is NOT hashing and is trivially reversible.
  invariant password_hashed {
    description: "must hash password with bcrypt or argon2"
    rule: storage.password uses [bcrypt, argon2]
    note: "base64/hex encoding is NOT acceptable — it is reversible"
  }

  # Plain-text password must never be persisted
  invariant no_plaintext_storage {
    description: "plain-text password must never be stored"
    rule: password.neverPersisted()
  }

  post success {
    - user.password_hash starts with "$2b$" or "$argon2"
    - original password is not recoverable from stored value
    - user.email is unique in the database
    - audit log records account creation
  }

  security {
    rate_limit: 10 per minute per ip
  }
}
