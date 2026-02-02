// Money Transfer Specification
// 
// This spec defines the rules for transferring money between accounts.
// The ISL Gate will verify any implementation against these rules.

domain MoneyTransfer version "1.0.0"

// An account holds money
entity Account {
  id: UUID
  owner: String
  balance: Decimal
  
  // Balance can never go negative
  invariant balance >= 0
}

// Transfer money between accounts
behavior Transfer {
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
      InsufficientFunds when "Sender doesn't have enough balance"
      InvalidAmount when "Amount must be positive"
      AccountNotFound when "Account not found"
      SameAccount when "Cannot transfer to same account"
    }
  }
  
  // Preconditions - must be true before execution
  pre amount > 0
  pre senderId != receiverId
  pre Account.exists({ id: senderId })
  pre Account.exists({ id: receiverId })
  pre sender.balance >= amount
  
  // Postconditions - must be true after success
  post success {
    // Sender loses exactly the amount
    sender.balance == old(sender.balance) - input.amount
    
    // Receiver gains exactly the amount
    receiver.balance == old(receiver.balance) + input.amount
    
    // Total money is conserved
    sender.balance + receiver.balance == old(sender.balance) + old(receiver.balance)
  }
  
  // Security constraints
  invariants {
    amount never_logged_plaintext
  }
}

// Check account balance
behavior GetBalance {
  input {
    accountId: UUID
  }
  
  output {
    success: Decimal
    errors {
      AccountNotFound when "Account not found"
    }
  }
  
  pre Account.exists({ id: accountId })
  
  post success {
    result == account.balance
  }
}
