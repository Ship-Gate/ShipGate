/**
 * Fixed Money Transfer Implementation
 * 
 * This implementation properly validates all preconditions
 * and maintains the invariants specified in the ISL spec.
 * 
 * The ISL Gate will verify this and return SHIP.
 */

interface Account {
  id: string;
  owner: string;
  balance: number;
}

interface TransferResult {
  transactionId: string;
  timestamp: Date;
}

// In-memory store
const accounts = new Map<string, Account>();

// Initialize some test accounts
accounts.set('alice-123', { id: 'alice-123', owner: 'Alice', balance: 1000 });
accounts.set('bob-456', { id: 'bob-456', owner: 'Bob', balance: 500 });

/**
 * Transfer money between accounts
 * 
 * All preconditions are validated:
 * ✓ Amount must be positive
 * ✓ Sender must have sufficient balance
 * ✓ Sender and receiver must be different
 * ✓ Both accounts must exist
 */
export function transfer(
  senderId: string,
  receiverId: string,
  amount: number
): TransferResult {
  // Validate amount is positive
  if (amount <= 0) {
    throw new Error('InvalidAmount: Amount must be positive');
  }

  // Validate sender and receiver are different
  if (senderId === receiverId) {
    throw new Error('SameAccount: Cannot transfer to same account');
  }

  const sender = accounts.get(senderId);
  const receiver = accounts.get(receiverId);

  // Validate accounts exist
  if (!sender) {
    throw new Error('AccountNotFound: Sender not found');
  }

  if (!receiver) {
    throw new Error('AccountNotFound: Receiver not found');
  }

  // Validate sufficient funds (THE KEY CHECK!)
  if (sender.balance < amount) {
    throw new Error('InsufficientFunds: Sender doesn\'t have enough balance');
  }

  // Store old values for verification
  const oldSenderBalance = sender.balance;
  const oldReceiverBalance = receiver.balance;

  // Perform the transfer
  sender.balance -= amount;
  receiver.balance += amount;

  // Verify postconditions (defensive)
  if (sender.balance !== oldSenderBalance - amount) {
    throw new Error('Postcondition failed: sender balance incorrect');
  }
  if (receiver.balance !== oldReceiverBalance + amount) {
    throw new Error('Postcondition failed: receiver balance incorrect');
  }

  // Verify invariant: balance >= 0
  if (sender.balance < 0) {
    // Rollback and throw
    sender.balance = oldSenderBalance;
    receiver.balance = oldReceiverBalance;
    throw new Error('Invariant violation: balance cannot be negative');
  }

  // Verify money conservation
  const totalBefore = oldSenderBalance + oldReceiverBalance;
  const totalAfter = sender.balance + receiver.balance;
  if (totalBefore !== totalAfter) {
    throw new Error('Invariant violation: money not conserved');
  }

  // Log WITHOUT the amount (security)
  console.log(`Transfer completed from ${sender.owner} to ${receiver.owner}`);

  return {
    transactionId: crypto.randomUUID(),
    timestamp: new Date(),
  };
}

/**
 * Get account balance
 */
export function getBalance(accountId: string): number {
  const account = accounts.get(accountId);
  
  if (!account) {
    throw new Error('AccountNotFound: Account not found');
  }

  return account.balance;
}

// Demo: This correctly fails with InsufficientFunds
// try {
//   transfer('alice-123', 'bob-456', 2000);
// } catch (e) {
//   console.log(e.message);  // "InsufficientFunds: ..."
// }

// This works correctly
// transfer('alice-123', 'bob-456', 500);
// getBalance('alice-123');  // Returns 500
// getBalance('bob-456');    // Returns 1000
