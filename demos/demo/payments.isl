// Demo ISL Specification - Payment Processing
// This spec defines a simple fund transfer behavior

domain Payments version "1.0.0"

entity Account {
  id: UUID
  balance: Decimal
  isActive: Boolean
}

behavior TransferFunds {
  input {
    senderId: UUID
    receiverId: UUID
    amount: Decimal
  }
  
  output {
    success: Account
  }
  
  preconditions {
    amount > 0
  }
  
  postconditions {
    success implies {
      result.balance >= 0
    }
  }
}
