version "1.0"

domain Auth {
  entity User {
    id: uuid [immutable, unique]
    email: string [unique, format: email]
    passwordHash: string [immutable]
    createdAt: datetime [immutable]
  }
  
  entity Session {
    id: uuid [immutable, unique]
    userId: uuid [immutable]
    token: string [immutable]
    expiresAt: datetime
  }
  
  behavior Login {
    input { email: string, password: string }
    output { session: Session }
    invariants {
      - input.email is not empty
      - input.password has at least 8 characters
      - output.session.expiresAt > now()
      - output.session.token is not empty
    }
  }
  
  behavior GetUser {
    input { userId: uuid }
    output { user: User }
    invariants {
      - input.userId is not null
      - output.user.id == input.userId
      - output.user.email is not empty
    }
  }
}
