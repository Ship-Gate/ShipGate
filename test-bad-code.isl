version "1.0"

domain Auth {
  entity User {
    id: uuid
    username: string [min: 3, max: 50, format: email]
    passwordHash: string [min: 60, max: 60] // bcrypt hash
  }
  
  behavior AuthenticateUser {
    input { username: string, password: string }
    output { success: boolean, user?: User }
    invariants {
      - input.username is not empty
      - input.password has at least 8 characters
      - output.success implies user exists
      - passwords are never compared in plaintext
    }
  }
  
  behavior GetUserData {
    input { userId: uuid }
    output { user: User }
    invariants {
      - input.userId is valid uuid format
      - output.user exists
      - never returns null
    }
  }
  
  behavior ProcessPayment {
    input { amount: decimal [min: 0.01, max: 10000] }
    output { success: boolean, transactionId?: uuid }
    invariants {
      - input.amount is positive
      - always returns a result
      - never throws unhandled exceptions
    }
  }
}
