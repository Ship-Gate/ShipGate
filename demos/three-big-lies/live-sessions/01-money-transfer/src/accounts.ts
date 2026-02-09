/**
 * Mobile Banking App - Accounts
 * 
 * Initial structure. You'll add the transfer function when you ask the AI.
 */

export interface Account {
  id: string;
  owner: string;
  balance: number;
}

const accounts = new Map<string, Account>();

accounts.set('alice', { id: 'alice', owner: 'Alice', balance: 100 });
accounts.set('bob', { id: 'bob', owner: 'Bob', balance: 50 });

export function getAccount(id: string): Account | undefined {
  return accounts.get(id);
}

export function getAllAccounts(): Account[] {
  return Array.from(accounts.values());
}

export type TransferResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Transfer amount from one account to another.
 * Validates amount, account existence, and sufficient balance.
 */
export function transfer(
  fromId: string,
  toId: string,
  amount: number
): TransferResult {
  if (amount <= 0) {
    return { success: false, error: "Amount must be positive" };
  }
  if (fromId === toId) {
    return { success: false, error: "Cannot transfer to the same account" };
  }

  const from = accounts.get(fromId);
  const to = accounts.get(toId);

  if (!from) {
    return { success: false, error: `Account not found: ${fromId}` };
  }
  if (!to) {
    return { success: false, error: `Account not found: ${toId}` };
  }
  if (from.balance < amount) {
    return { success: false, error: "Insufficient balance" };
  }

  from.balance -= amount;
  to.balance += amount;

  return { success: true };
}

export { accounts };
