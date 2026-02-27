/**
 * Good implementation - validates preconditions
 */
const accounts = new Map<string, { id: string; balance: number }>();

export function transfer(fromId: string, toId: string, amount: number): { success: boolean } {
  if (amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }
  if (fromId === toId) {
    throw new Error("SAME_ACCOUNT");
  }

  const from = accounts.get(fromId);
  const to = accounts.get(toId);
  if (!from || !to) throw new Error("NOT_FOUND");
  if (from.balance < amount) throw new Error("INSUFFICIENT_FUNDS");

  from.balance -= amount;
  to.balance += amount;
  return { success: true };
}
