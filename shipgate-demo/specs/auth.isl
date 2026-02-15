/**
 * Demo Auth Domain
 * 
 * A simple authentication domain demonstrating ShipGate verification.
 */

domain Auth {
  entity User {
    id: UUID [immutable, unique]
    email: Email [unique]
    passwordHash: String [immutable]
    createdAt: DateTime [immutable]
  }

  entity Session {
    id: UUID [immutable, unique]
    userId: UUID [immutable]
    token: String [immutable]
    expiresAt: DateTime
  }

  behavior Login {
    input {
      email: Email
      password: String
    }
    output {
      session: Session
    }
    preconditions {
      email.length > 0
      password.length >= 8
    }
    postconditions {
      Session.exists(output.session.id)
      output.session.userId != null
      output.session.token.length > 0
    }
    invariants {
      output.session.expiresAt > now()
    }
  }

  behavior GetUser {
    input {
      userId: UUID
    }
    output {
      user: User
    }
    preconditions {
      userId != null
    }
    postconditions {
      output.user.id == input.userId
      output.user.email != null
    }
  }
}
