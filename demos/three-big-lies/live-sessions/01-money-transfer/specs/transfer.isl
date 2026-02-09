# Money Transfer Specification
# Defines safe transfer rules - balance can never go negative

domain MoneyTransfer version "1.0.0"

entity Account {
  id: UUID
  owner: String
  balance: Decimal
  
  invariants {
    balance >= 0
  }
}

behavior Transfer {
  description: "Transfer money between two accounts"
  
  input {
    senderId: UUID
    receiverId: UUID
    amount: Decimal
  }
  
  output {
    success: {
      transactionId: UUID
      timestamp: Timestamp
    }
    errors {
      InsufficientFunds when "Sender balance < amount"
      InvalidAmount when "Amount <= 0"
    }
  }
  
  preconditions {
    - amount > 0
    - senderId != receiverId
    - sender.balance >= amount
  }
  
  postconditions {
    success implies {
      - sender.balance == old(sender.balance) - amount
      - receiver.balance == old(receiver.balance) + amount
    }
  }
}
