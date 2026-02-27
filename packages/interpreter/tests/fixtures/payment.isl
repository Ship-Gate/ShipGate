// ============================================================================
// Payment Domain - ISL Specification
// Example spec for interpreter testing
// ============================================================================

domain Payments version "1.0.0"

// ============================================================================
// TYPES
// ============================================================================

type Money = Decimal(precision: 2) where value >= 0

type Currency = enum {
  USD
  EUR
  GBP
}

type TransactionStatus = enum {
  Pending
  Completed
  Failed
  Reversed
}

// ============================================================================
// ENTITIES
// ============================================================================

entity Account {
  id: UUID @id
  balance: Money
  currency: Currency
  isActive: Boolean
  
  invariant balance >= 0
}

entity Transaction {
  id: UUID @id
  senderId: UUID
  receiverId: UUID
  amount: Money
  status: TransactionStatus
  createdAt: Timestamp
  completedAt: Timestamp?
}

// ============================================================================
// BEHAVIORS
// ============================================================================

behavior TransferFunds {
  """
  Transfer funds from one account to another.
  """
  
  input {
    sender: Account
    receiver: Account
    amount: Money
  }
  
  output {
    success: Transaction
    errors {
      InsufficientFunds when "sender has insufficient balance"
      InvalidAmount when "amount is not positive"
      InactiveAccount when "either account is inactive"
      SameAccount when "sender and receiver are the same"
    }
  }
  
  // Preconditions
  pre amount > 0
  pre amount <= sender.balance
  pre sender.isActive and receiver.isActive
  pre sender.id != receiver.id
  
  // Postconditions
  post success {
    sender.balance == old(sender.balance) - amount
    receiver.balance == old(receiver.balance) + amount
    result.status == TransactionStatus.Completed
    result.amount == amount
  }
  
  post InsufficientFunds {
    sender.balance == old(sender.balance)
    receiver.balance == old(receiver.balance)
  }
  
  // Invariants (must hold before and after)
  invariant sender.balance >= 0
  invariant receiver.balance >= 0
  
  // Temporal constraints
  temporal {
    response within 5s at p99
  }
  
  // Security
  security {
    requires authentication
    rate_limit 100 per 1m per user
  }
}

behavior Deposit {
  """
  Deposit funds into an account.
  """
  
  input {
    account: Account
    amount: Money
  }
  
  output {
    success: Transaction
    errors {
      InvalidAmount when "amount is not positive"
      InactiveAccount when "account is inactive"
    }
  }
  
  pre amount > 0
  pre account.isActive
  
  post success {
    account.balance == old(account.balance) + amount
    result.status == TransactionStatus.Completed
  }
  
  invariant account.balance >= 0
}

behavior Withdraw {
  """
  Withdraw funds from an account.
  """
  
  input {
    account: Account
    amount: Money
  }
  
  output {
    success: Transaction
    errors {
      InsufficientFunds when "account has insufficient balance"
      InvalidAmount when "amount is not positive"
      InactiveAccount when "account is inactive"
    }
  }
  
  pre amount > 0
  pre amount <= account.balance
  pre account.isActive
  
  post success {
    account.balance == old(account.balance) - amount
    result.status == TransactionStatus.Completed
  }
  
  post InsufficientFunds {
    account.balance == old(account.balance)
  }
  
  invariant account.balance >= 0
}

// ============================================================================
// SCENARIOS
// ============================================================================

scenarios for TransferFunds {
  scenario "happy path" {
    given {
      sender = Account { balance: 500, isActive: true }
      receiver = Account { balance: 100, isActive: true }
      amount = 100
    }
    when {
      result = TransferFunds(sender, receiver, amount)
    }
    then {
      result.status == TransactionStatus.Completed
      sender.balance == 400
      receiver.balance == 200
    }
  }
  
  scenario "insufficient funds" {
    given {
      sender = Account { balance: 50, isActive: true }
      receiver = Account { balance: 100, isActive: true }
      amount = 100
    }
    when {
      result = TransferFunds(sender, receiver, amount)
    }
    then {
      result.status == TransactionStatus.Failed
      result.error.code == "INSUFFICIENT_FUNDS"
      sender.balance == 50
      receiver.balance == 100
    }
  }
  
  scenario "inactive sender" {
    given {
      sender = Account { balance: 500, isActive: false }
      receiver = Account { balance: 100, isActive: true }
      amount = 100
    }
    when {
      result = TransferFunds(sender, receiver, amount)
    }
    then {
      result.error.code == "INACTIVE_ACCOUNT"
    }
  }
  
  scenario "zero amount" {
    given {
      sender = Account { balance: 500, isActive: true }
      receiver = Account { balance: 100, isActive: true }
      amount = 0
    }
    when {
      result = TransferFunds(sender, receiver, amount)
    }
    then {
      result.error.code == "INVALID_AMOUNT"
    }
  }
}

// ============================================================================
// CHAOS SCENARIOS
// ============================================================================

chaos for TransferFunds {
  scenario "database failure during commit" {
    inject {
      database_failure(target: "commit", probability: 1.0)
    }
    when {
      result = TransferFunds(sender, receiver, amount)
    }
    then {
      // Transaction should be rolled back
      sender.balance == old(sender.balance)
      receiver.balance == old(receiver.balance)
      result.error.code == "DATABASE_ERROR"
    }
  }
  
  scenario "network latency" {
    inject {
      network_latency(target: "database", delay: 2s)
    }
    when {
      result = TransferFunds(sender, receiver, amount)
    }
    then {
      // Should still complete successfully
      result.status == TransactionStatus.Completed
    }
  }
}

// ============================================================================
// GLOBAL INVARIANTS
// ============================================================================

invariant MoneyConservation {
  """
  Total money in the system must remain constant during transfers.
  """
  scope: transaction
  
  always {
    sum(accounts.map(a => a.balance)) == old(sum(accounts.map(a => a.balance)))
  }
}

invariant NoNegativeBalances {
  """
  No account should ever have a negative balance.
  """
  scope: global
  
  always {
    all a in accounts: a.balance >= 0
  }
}
