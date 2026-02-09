/**
 * AI-GENERATED: Money Transfer
 *
 * Prompt: "Write a function to transfer money between two bank accounts"
 *
 * THE LIE: "This handles transfers correctly"
 * THE BUG: No balance check - you can steal money by transferring more than you have
 */

const accounts = new Map<string, { id: string; balance: number }>();

accounts.set('alice', { id: 'alice', balance: 100 });
accounts.set('bob', { id: 'bob', balance: 50 });

export function transfer(
  fromId: string,
  toId: string,
  amount: number
): { success: boolean; transactionId: string } {
  const from = accounts.get(fromId);
  const to = accounts.get(toId);

  if (!from || !to) {
    throw new Error('Account not found');
  }

  // BUG: No check if from.balance >= amount!
  // Alice has $100, she "transfers" $1000 -> Bob gets $1000, Alice goes to -$900
  from.balance -= amount;
  to.balance += amount;

  return {
    success: true,
    transactionId: `tx_${Date.now()}`,
  };
}
