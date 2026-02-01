// ============================================================================
// Payment Module - Target Implementation
// Example target code for interpreter testing
// ============================================================================

export interface Account {
  id: string;
  balance: number;
  currency: string;
  isActive: boolean;
}

export interface Transaction {
  id: string;
  senderId: string;
  receiverId: string;
  amount: number;
  status: 'Pending' | 'Completed' | 'Failed' | 'Reversed';
  createdAt: Date;
  completedAt?: Date;
  error?: TransactionError;
}

export interface TransactionError {
  code: string;
  message: string;
}

export interface TransferResult {
  success: boolean;
  transaction?: Transaction;
  error?: TransactionError;
}

/**
 * Transfer funds from sender to receiver.
 */
export async function transferFunds(
  sender: Account,
  receiver: Account,
  amount: number
): Promise<TransferResult> {
  // Validate amount
  if (amount <= 0) {
    return {
      success: false,
      error: {
        code: 'INVALID_AMOUNT',
        message: 'Amount must be positive',
      },
    };
  }
  
  // Check accounts are active
  if (!sender.isActive) {
    return {
      success: false,
      error: {
        code: 'INACTIVE_ACCOUNT',
        message: 'Sender account is inactive',
      },
    };
  }
  
  if (!receiver.isActive) {
    return {
      success: false,
      error: {
        code: 'INACTIVE_ACCOUNT',
        message: 'Receiver account is inactive',
      },
    };
  }
  
  // Check same account
  if (sender.id === receiver.id) {
    return {
      success: false,
      error: {
        code: 'SAME_ACCOUNT',
        message: 'Cannot transfer to the same account',
      },
    };
  }
  
  // Check sufficient balance
  if (amount > sender.balance) {
    return {
      success: false,
      error: {
        code: 'INSUFFICIENT_FUNDS',
        message: 'Sender has insufficient balance',
      },
    };
  }
  
  // Perform transfer
  const now = new Date();
  sender.balance -= amount;
  receiver.balance += amount;
  
  const transaction: Transaction = {
    id: crypto.randomUUID(),
    senderId: sender.id,
    receiverId: receiver.id,
    amount,
    status: 'Completed',
    createdAt: now,
    completedAt: now,
  };
  
  return {
    success: true,
    transaction,
  };
}

/**
 * Deposit funds into an account.
 */
export async function deposit(
  account: Account,
  amount: number
): Promise<TransferResult> {
  if (amount <= 0) {
    return {
      success: false,
      error: {
        code: 'INVALID_AMOUNT',
        message: 'Amount must be positive',
      },
    };
  }
  
  if (!account.isActive) {
    return {
      success: false,
      error: {
        code: 'INACTIVE_ACCOUNT',
        message: 'Account is inactive',
      },
    };
  }
  
  const now = new Date();
  account.balance += amount;
  
  const transaction: Transaction = {
    id: crypto.randomUUID(),
    senderId: 'SYSTEM',
    receiverId: account.id,
    amount,
    status: 'Completed',
    createdAt: now,
    completedAt: now,
  };
  
  return {
    success: true,
    transaction,
  };
}

/**
 * Withdraw funds from an account.
 */
export async function withdraw(
  account: Account,
  amount: number
): Promise<TransferResult> {
  if (amount <= 0) {
    return {
      success: false,
      error: {
        code: 'INVALID_AMOUNT',
        message: 'Amount must be positive',
      },
    };
  }
  
  if (!account.isActive) {
    return {
      success: false,
      error: {
        code: 'INACTIVE_ACCOUNT',
        message: 'Account is inactive',
      },
    };
  }
  
  if (amount > account.balance) {
    return {
      success: false,
      error: {
        code: 'INSUFFICIENT_FUNDS',
        message: 'Account has insufficient balance',
      },
    };
  }
  
  const now = new Date();
  account.balance -= amount;
  
  const transaction: Transaction = {
    id: crypto.randomUUID(),
    senderId: account.id,
    receiverId: 'SYSTEM',
    amount,
    status: 'Completed',
    createdAt: now,
    completedAt: now,
  };
  
  return {
    success: true,
    transaction,
  };
}

// Default export for module binding tests
export default {
  transferFunds,
  deposit,
  withdraw,
};
